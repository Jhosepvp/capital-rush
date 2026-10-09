import Phaser from 'phaser';

/**
 * Lightweight, mobile-friendly game-feel helpers. Everything here is a
 * short-lived, self-cleaning effect — no persistent emitters, no heavy
 * particle counts, so it stays cheap on low-end phones.
 */

let shakeBudgetUntil = 0;

export const FX = {
  hitSpark(scene: Phaser.Scene, x: number, y: number, color = 0xffffff, count = 6) {
    if (!scene.textures.exists('particle')) return;
    const emitter = scene.add.particles(x, y, 'particle', {
      speed: { min: 60, max: 160 },
      lifespan: 220,
      scale: { start: 0.9, end: 0 },
      tint: color,
      quantity: count,
      emitting: false,
    });
    emitter.explode(count);
    scene.time.delayedCall(260, () => emitter.destroy());
  },

  floatingText(scene: Phaser.Scene, x: number, y: number, text: string, color = '#ffffff', fontSize = '16px') {
    const label = scene.add
      .text(x, y, text, {
        fontFamily: 'Arial, sans-serif',
        fontSize,
        color,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(800);

    scene.tweens.add({
      targets: label,
      y: y - 36,
      alpha: 0,
      duration: 650,
      ease: 'Cubic.easeOut',
      onComplete: () => label.destroy(),
    });
  },

  /** Punches scale relative to the target's current scale (not an absolute value), so it works for both unit-scale Arcs and sprites with an arbitrary base display scale. */
  scalePunch(scene: Phaser.Scene, target: Phaser.GameObjects.Components.Transform, factor = 1.2) {
    const baseX = target.scaleX;
    const baseY = target.scaleY;
    scene.tweens.add({
      targets: target,
      scaleX: baseX * factor,
      scaleY: baseY * factor,
      duration: 70,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  },

  /** Flash via tint (for Sprites — Crate etc. use spriteBurst instead). */
  flashTint(scene: Phaser.Scene, target: Phaser.GameObjects.Sprite, color = 0xffffff, durationMs = 70) {
    target.setTintFill(color);
    scene.time.delayedCall(durationMs, () => {
      if (target.active) target.clearTint();
    });
  },

  /**
   * Generic one-shot sprite VFX: place a processed asset (muzzle flash, hit
   * spark, death burst, pickup flourish, boss ring, ...), scale/fade it,
   * then destroy it. Covers every "flash an image briefly" need in the
   * game with one function instead of a method per effect.
   */
  spriteBurst(
    scene: Phaser.Scene,
    key: string,
    x: number,
    y: number,
    opts: {
      rotation?: number;
      startScale?: number;
      endScale?: number;
      startAlpha?: number;
      endAlpha?: number;
      duration?: number;
      depth?: number;
      blendMode?: Phaser.BlendModes;
    } = {}
  ): Phaser.GameObjects.Image | null {
    if (!scene.textures.exists(key)) return null;
    const img = scene.add.image(x, y, key);
    img.setRotation(opts.rotation ?? 0);
    img.setDepth(opts.depth ?? 750);
    img.setScale(opts.startScale ?? 0.6);
    img.setAlpha(opts.startAlpha ?? 1);
    if (opts.blendMode !== undefined) img.setBlendMode(opts.blendMode);

    scene.tweens.add({
      targets: img,
      scale: opts.endScale ?? 1.15,
      alpha: opts.endAlpha ?? 0,
      duration: opts.duration ?? 220,
      ease: 'Quad.easeOut',
      onComplete: () => img.destroy(),
    });

    return img;
  },

  screenShake(scene: Phaser.Scene, duration = 100, intensity = 0.0025) {
    const now = scene.time.now;
    if (now < shakeBudgetUntil) return;
    shakeBudgetUntil = now + duration + 150;
    scene.cameras.main.shake(duration, intensity);
  },
};
