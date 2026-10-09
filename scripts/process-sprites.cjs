#!/usr/bin/env node
/**
 * Processes the raw 4x4 character sheets in assets-source/sprites/ into
 * per-frame, alpha-trimmed PNGs under public/assets/sprites/<character>/.
 *
 * Re-run with `npm run sprites` any time a source sheet is replaced.
 *
 * Pipeline per character:
 *   1. Isolate each of the 16 cells via connected-component flood fill on
 *      the alpha channel (not a naive width/4,height/4 crop) so weapons,
 *      hair, etc. that cross the nominal cell boundary are not clipped.
 *   2. Use each direction's IDLE frame as the alignment reference (center-x
 *      + bottom-y). All 4 frames of a direction share that direction's
 *      offset, so limb/weapon motion is preserved exactly as drawn instead
 *      of being re-centered frame by frame (which is what causes jitter).
 *   3. Size one shared canvas per character to fit every frame's extents
 *      (plus padding), so all 16 output frames are pixel-identical in size
 *      and the character's anchor point lands on the same canvas pixel in
 *      every frame.
 *   4. Downscale to a reasonable export resolution (not the native
 *      multi-thousand-pixel crop) and write <direction>_<pose>.png plus a
 *      meta.json describing canvas size and anchor point for the game code.
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'assets-source', 'sprites');
const OUT_DIR = path.join(ROOT, 'public', 'assets', 'sprites');

const GRID = 4;
const DIRECTIONS = ['down', 'up', 'left', 'right'];
const POSES = ['idle', 'walk_1', 'walk_2', 'attack'];

const ALPHA_THRESHOLD = 12; // 0-255; low on purpose to keep soft glow/hair edges
const PADDING = 10; // px, at native crop resolution, before downscaling
const LEAK_GUARD_RATIO = 1.8; // flood fill bbox vs nominal cell size safety net
const EXPORT_SCALE_FACTOR = 2; // exported px per target on-screen px (retina headroom)

// targetHeight = desired ON-SCREEN display height in the game, used only to
// size the exported file sensibly; actual Phaser scale is computed at
// runtime from meta.json so this script staying in sync with balance.ts is
// not load-bearing for correctness, just for not shipping oversized files.
const CHARACTERS = [
  { key: 'player', file: 'player.png', targetHeight: 64 },
  { key: 'bruiser', file: 'bruiser.png', targetHeight: 76 },
  { key: 'shooter', file: 'shooter.png', targetHeight: 62 },
  { key: 'lancer', file: 'lancer.png', targetHeight: 66 },
  { key: 'collector', file: 'collector.png', targetHeight: 120 },
];

async function loadRawRGBA(filePath) {
  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

function nominalCell(width, height, row, col) {
  const x0 = Math.round((col * width) / GRID);
  const x1 = Math.round(((col + 1) * width) / GRID);
  const y0 = Math.round((row * height) / GRID);
  const y1 = Math.round(((row + 1) * height) / GRID);
  return { x0, y0, x1, y1 };
}

function strictBBox(data, width, channels, region) {
  const { x0, y0, x1, y1 } = region;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const a = data[(y * width + x) * channels + 3];
      if (a > ALPHA_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (minX === Infinity) return null;
  return { minX, minY, maxX, maxY };
}

/** 8-connected flood fill over the alpha channel, seeded inside `region`. */
function floodFillBBox(data, width, height, channels, region, visited) {
  const seed = strictBBox(data, width, channels, region);
  if (!seed) return null;
  const seedX = Math.floor((seed.minX + seed.maxX) / 2);
  const seedY = Math.floor((seed.minY + seed.maxY) / 2);

  const queue = [seedY * width + seedX];
  visited[seedY * width + seedX] = 1;
  let minX = seedX, maxX = seedX, minY = seedY, maxY = seedY;
  let head = 0;

  while (head < queue.length) {
    const idx = queue[head++];
    const y = Math.floor(idx / width);
    const x = idx - y * width;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const nIdx = ny * width + nx;
        if (visited[nIdx]) continue;
        if (data[nIdx * channels + 3] > ALPHA_THRESHOLD) {
          visited[nIdx] = 1;
          queue.push(nIdx);
        }
      }
    }
  }

  return { minX, minY, maxX, maxY };
}

function cellBBox(data, width, height, channels, region, visited) {
  const flooded = floodFillBBox(data, width, height, channels, region, visited);
  const nominalW = region.x1 - region.x0;
  const nominalH = region.y1 - region.y0;

  if (
    flooded &&
    flooded.maxX - flooded.minX <= nominalW * LEAK_GUARD_RATIO &&
    flooded.maxY - flooded.minY <= nominalH * LEAK_GUARD_RATIO
  ) {
    return flooded;
  }

  // Flood fill leaked into a neighboring cell (or found nothing): fall back
  // to a strict, boundary-respecting crop and warn so it can be reviewed.
  console.warn(`  ! flood fill leak guard triggered for a cell, falling back to strict crop`);
  return strictBBox(data, width, channels, region) ?? { minX: region.x0, minY: region.y0, maxX: region.x1 - 1, maxY: region.y1 - 1 };
}

async function processCharacter(def) {
  const srcPath = path.join(SRC_DIR, def.file);
  const { data, width, height, channels } = await loadRawRGBA(srcPath);
  const visited = new Uint8Array(width * height);

  // 1. Per-cell bounding boxes via flood fill. Kept in both GLOBAL sheet
  //    coordinates (needed to extract the real pixels) and LOCAL
  //    coordinates relative to that cell's own nominal top-left corner
  //    (needed for alignment math below — columns live at very different
  //    global X positions purely because of grid layout, so comparing
  //    global coordinates across columns would be meaningless).
  const cells = [];
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const region = nominalCell(width, height, row, col);
      const g = cellBBox(data, width, height, channels, region, visited);
      const local = { minX: g.minX - region.x0, minY: g.minY - region.y0, maxX: g.maxX - region.x0, maxY: g.maxY - region.y0 };
      cells.push({ global: g, local });
    }
  }

  // 2. Per-direction alignment reference = that direction's idle frame,
  //    in local coordinates.
  const refByRow = [];
  for (let row = 0; row < GRID; row++) {
    const idle = cells[row * GRID + 0].local;
    refByRow.push({ centerX: (idle.minX + idle.maxX) / 2, bottomY: idle.maxY });
  }

  // 3. Shared extents (relative to each frame's own direction reference)
  //    across all 16 frames, so one canvas size fits everything.
  let minRelLeft = Infinity, maxRelRight = -Infinity, minRelTop = Infinity, maxRelBottom = -Infinity;
  for (let row = 0; row < GRID; row++) {
    const ref = refByRow[row];
    for (let col = 0; col < GRID; col++) {
      const b = cells[row * GRID + col].local;
      minRelLeft = Math.min(minRelLeft, b.minX - ref.centerX);
      maxRelRight = Math.max(maxRelRight, b.maxX - ref.centerX);
      minRelTop = Math.min(minRelTop, b.minY - ref.bottomY);
      maxRelBottom = Math.max(maxRelBottom, b.maxY - ref.bottomY);
    }
  }

  const leftExtent = Math.ceil(-minRelLeft + PADDING);
  const rightExtent = Math.ceil(maxRelRight + PADDING);
  const topExtent = Math.ceil(-minRelTop + PADDING);
  const bottomExtent = Math.ceil(maxRelBottom + PADDING);

  const canvasW = leftExtent + rightExtent;
  const canvasH = topExtent + bottomExtent;
  const anchorX = leftExtent;
  const anchorY = topExtent;

  // 4. Crop + composite every frame onto an identically-sized canvas so the
  //    anchor point lands on the same pixel in every exported frame.
  const outDir = path.join(OUT_DIR, def.key);
  fs.mkdirSync(outDir, { recursive: true });
  const base = sharp(srcPath).ensureAlpha();

  const exportScale = (def.targetHeight * EXPORT_SCALE_FACTOR) / canvasH;
  const exportW = Math.max(1, Math.round(canvasW * exportScale));
  const exportH = Math.max(1, Math.round(canvasH * exportScale));

  const frames = [];
  for (let row = 0; row < GRID; row++) {
    const direction = DIRECTIONS[row];
    const ref = refByRow[row];
    const offsetX = anchorX - ref.centerX;
    const offsetY = anchorY - ref.bottomY;

    for (let col = 0; col < GRID; col++) {
      const pose = POSES[col];
      const { global: g, local } = cells[row * GRID + col];
      const cropW = g.maxX - g.minX + 1;
      const cropH = g.maxY - g.minY + 1;

      let destX = Math.round(local.minX + offsetX);
      let destY = Math.round(local.minY + offsetY);
      // Defensive clamp: the math above should always land in-bounds, but
      // never let a future source-image edge case crash the whole run.
      destX = Math.min(Math.max(destX, 0), Math.max(0, canvasW - cropW));
      destY = Math.min(Math.max(destY, 0), Math.max(0, canvasH - cropH));

      const croppedBuffer = await base.clone().extract({ left: g.minX, top: g.minY, width: cropW, height: cropH }).png().toBuffer();

      const frameName = `${direction}_${pose}`;
      frames.push(frameName);

      // Composite at native resolution first, then resize as a separate
      // step — sharp applies resize() before composite() internally
      // regardless of call order, so chaining them in one pipeline would
      // shrink the blank canvas before the (still full-size) overlay is
      // placed on it.
      const composited = await sharp({
        create: { width: canvasW, height: canvasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
      })
        .composite([{ input: croppedBuffer, left: destX, top: destY }])
        .png()
        .toBuffer();

      await sharp(composited).resize(exportW, exportH).png({ compressionLevel: 9, effort: 10 }).toFile(path.join(outDir, `${frameName}.png`));
    }
  }

  const meta = {
    canvasWidth: exportW,
    canvasHeight: exportH,
    anchorX: Math.round(anchorX * exportScale),
    anchorY: Math.round(anchorY * exportScale),
    targetDisplayHeight: def.targetHeight,
    frames,
  };
  fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify(meta, null, 2));

  console.log(`${def.key}: native canvas ${canvasW}x${canvasH} -> exported ${exportW}x${exportH}, anchor (${meta.anchorX},${meta.anchorY})`);
}

(async () => {
  console.log(`Source: ${SRC_DIR}`);
  console.log(`Output: ${OUT_DIR}\n`);

  for (const def of CHARACTERS) {
    const srcPath = path.join(SRC_DIR, def.file);
    if (!fs.existsSync(srcPath)) {
      console.warn(`Skipping ${def.key}: ${srcPath} not found`);
      continue;
    }
    await processCharacter(def);
  }

  console.log('\nDone.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
