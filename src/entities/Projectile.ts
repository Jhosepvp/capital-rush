import Phaser from 'phaser';
import { COMBAT } from '../data/balance';

export class Projectile extends Phaser.GameObjects.Arc {
  declare body: Phaser.Physics.Arcade.Body;

  damage: number;
  spawnedAt: number;
  readonly visual: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    damage: number,
    time: number
  ) {
    super(scene, x, y, COMBAT.projectileRadius, 0, 360, false, 0xffe066, 1);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Hitbox stays the original small circle, unaffected by the sprite's
    // visual size (the glow trail is not part of the collider).
    this.body.setCircle(COMBAT.projectileRadius);
    this.body.setVelocity(dirX * COMBAT.projectileSpeed, dirY * COMBAT.projectileSpeed);
    this.setDepth(6);
    this.setVisible(false);

    this.visual = scene.add.image(x, y, 'player_projectile');
    this.visual.setRotation(Math.atan2(dirY, dirX));
    this.visual.setScale(COMBAT.projectileVisualScale);
    this.visual.setDepth(6);

    this.damage = damage;
    this.spawnedAt = time;
  }

  /** Call once per frame to keep the visual glued to the (invisible) physics body. */
  syncVisual() {
    this.visual.setPosition(this.x, this.y);
  }

  isExpired(time: number): boolean {
    return time - this.spawnedAt > COMBAT.projectileLifetime;
  }

  destroy(fromScene?: boolean): void {
    this.visual.destroy();
    super.destroy(fromScene);
  }
}
