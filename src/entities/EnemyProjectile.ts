import Phaser from 'phaser';
import { COMBAT } from '../data/balance';

export class EnemyProjectile extends Phaser.GameObjects.Arc {
  declare body: Phaser.Physics.Arcade.Body;

  damage: number;
  spawnedAt: number;
  lifetimeMs: number;
  readonly textureKey: string;
  readonly visual: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    speed: number,
    radius: number,
    color: number,
    damage: number,
    time: number,
    textureKey: string,
    lifetimeMs = 2200
  ) {
    super(scene, x, y, radius, 0, 360, false, color, 1);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Hitbox stays the original geometric circle — the sprite's glow is
    // purely visual and intentionally larger than the real collider.
    this.body.setCircle(radius);
    this.body.setVelocity(dirX * speed, dirY * speed);
    this.setDepth(6);
    this.setVisible(false);

    this.visual = scene.add.image(x, y, textureKey);
    this.visual.setRotation(Math.atan2(dirY, dirX));
    this.visual.setScale(COMBAT.projectileVisualScale);
    this.visual.setDepth(6);

    this.damage = damage;
    this.spawnedAt = time;
    this.lifetimeMs = lifetimeMs;
    this.textureKey = textureKey;
  }

  syncVisual() {
    this.visual.setPosition(this.x, this.y);
  }

  isExpired(time: number): boolean {
    return time - this.spawnedAt > this.lifetimeMs;
  }

  destroy(fromScene?: boolean): void {
    this.visual.destroy();
    super.destroy(fromScene);
  }
}
