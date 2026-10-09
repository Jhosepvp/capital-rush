#!/usr/bin/env node
/**
 * Processes everything in assets-source/ EXCEPT the character sheets
 * (those already have their own reproducible pipeline — see
 * process-sprites.cjs / npm run sprites — and are left untouched here).
 *
 * Handles:
 *   - environment/arena_background.png -> public/assets/environment/
 *     (just a resize; it's a single opaque scene image, not a sheet)
 *   - The 3 non-uniform sheets (projectiles+pickups, props, vfx) driven by
 *     scripts/assets-manifest.json: each entry gives an explicit, manually
 *     chosen region (NOT a grid cell, NOT connected-components across the
 *     whole sheet — items sit close together with overlapping glow halos,
 *     so blind flood-fill would merge neighbors). Inside that region we
 *     trim to the real alpha bounding box, add padding, and export.
 *
 * Re-run with `npm run assets` any time a source file changes. Edit
 * scripts/assets-manifest.json (not this file) to adjust a region.
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'assets-source');
const OUT_DIR = path.join(ROOT, 'public', 'assets');
const ALPHA_THRESHOLD = 10;

async function processArenaBackground() {
  const src = path.join(SRC_DIR, 'environment', 'arena_background.png');
  if (!fs.existsSync(src)) {
    console.warn('Skipping arena background: not found at', src);
    return;
  }
  const outDir = path.join(OUT_DIR, 'environment');
  fs.mkdirSync(outDir, { recursive: true });

  // Re-compressed at native resolution — no upscaling here. The game
  // covers the (larger) arena world via Phaser's setDisplaySize at render
  // time, which is normal GPU texture scaling, not a pre-baked upscale.
  const meta = await sharp(src).metadata();
  await sharp(src).png({ compressionLevel: 9, effort: 10 }).toFile(path.join(outDir, 'arena_background.png'));

  console.log(`arena_background: kept native ${meta.width}x${meta.height}`);
}

function findAlphaBBox(data, sheetWidth, channels, region) {
  const x0 = Math.max(0, region.x);
  const y0 = Math.max(0, region.y);
  const x1 = region.x + region.width;
  const y1 = region.y + region.height;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const a = data[(y * sheetWidth + x) * channels + 3];
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

async function processGroup(groupName, group) {
  const sheetPath = path.join(SRC_DIR, group.sheet);
  if (!fs.existsSync(sheetPath)) {
    console.warn(`Skipping group "${groupName}": sheet not found at ${sheetPath}`);
    return;
  }

  const { data, info } = await sharp(sheetPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const outDir = path.join(OUT_DIR, group.outDir);
  fs.mkdirSync(outDir, { recursive: true });

  const base = sharp(sheetPath).ensureAlpha();

  for (const item of group.items) {
    const bbox = findAlphaBBox(data, info.width, info.channels, item);
    if (!bbox) {
      console.warn(`  ! ${groupName}/${item.name}: no visible pixels found in region, skipping`);
      continue;
    }

    const pad = item.padding ?? 6;
    const left = Math.max(0, bbox.minX - pad);
    const top = Math.max(0, bbox.minY - pad);
    const right = Math.min(info.width, bbox.maxX + pad + 1);
    const bottom = Math.min(info.height, bbox.maxY + pad + 1);
    const cropW = right - left;
    const cropH = bottom - top;

    const exportScale = group.exportScale ?? 0.4;
    const exportW = Math.max(1, Math.round(cropW * exportScale));
    const exportH = Math.max(1, Math.round(cropH * exportScale));

    await base
      .clone()
      .extract({ left, top, width: cropW, height: cropH })
      .resize(exportW, exportH)
      .png({ compressionLevel: 9, effort: 10 })
      .toFile(path.join(outDir, `${item.name}.png`));

    console.log(`  ${groupName}/${item.name}: region(${item.x},${item.y},${item.width}x${item.height}) -> crop ${cropW}x${cropH} -> exported ${exportW}x${exportH}`);
  }
}

(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'assets-manifest.json'), 'utf-8'));

  console.log('Arena background:');
  await processArenaBackground();

  for (const groupName of ['projectiles', 'pickups', 'props', 'vfx']) {
    console.log(`\n${groupName}:`);
    await processGroup(groupName, manifest[groupName]);
  }

  console.log('\nDone.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
