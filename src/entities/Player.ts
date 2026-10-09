import Phaser from 'phaser';
import { PLAYER } from '../data/balance';
import { FX } from '../systems/FX';
import { CharacterVisual, SpriteMeta } from './CharacterVisual';

export class Player extends Phaser.GameObjects.Arc {
  declare body: Phaser.Physics.Arcade.Body;

  maxHealth: number;
  health: number;
  damageReduction: number;
  lastHitAt = -Infinity;
  readonly visual: CharacterVisual;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, PLAYER.radius, 0, 360, false, PLAYER.color, 1);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setCircle(PLAYER.radius);
    this.body.setCollideWorldBounds(true);
    this.setDepth(10);
    // The Arc stays as the (invisible) physics body — the sprite is the
    // only thing actually drawn, so collision/balance is untouched.
    this.setVisible(false);

    const meta = scene.cache.json.get('player_meta') as SpriteMeta;
    this.visual = new CharacterVisual(scene, 'player', x, y, meta, 10);

    this.maxHealth = PLAYER.maxHealth;
    this.health = this.maxHealth;
    this.damageReduction = 0;
  }

  move(vx: number, vy: number) {
    this.body.setVelocity(vx * PLAYER.moveSpeed, vy * PLAYER.moveSpeed);
  }

  /** Called once per frame by GameScene to sync the visual to the physics body. */
  syncVisual(time: number) {
    this.visual.update(this.x, this.y, this.body.velocity.x, this.body.velocity.y, time);
  }

  /** Shows the attack pose briefly, aimed at the given direction (e.g. toward an auto-target), independent of movement. */
  triggerAttackVisual(dirX: number, dirY: number, time: number) {
    this.visual.triggerAttack(dirX, dirY, time);
  }

  takeDamage(amount: number, time: number): number {
    if (time - this.lastHitAt < PLAYER.hitInvulnMs) return 0;

    const mitigated = amount * (1 - this.damageReduction);
    this.health = Math.max(0, this.health - mitigated);
    this.lastHitAt = time;

    FX.flashTint(this.scene, this.visual.sprite, 0xff5555);
    FX.hitSpark(this.scene, this.x, this.y, 0xff5555, 5);
    if (mitigated >= 18) FX.screenShake(this.scene, 90, 0.0025);

    return mitigated;
  }

  applyKnockback(fromX: number, fromY: number, force: number, _time: number) {
    const dx = this.x - fromX;
    const dy = this.y - fromY;
    const len = Math.hypot(dx, dy) || 1;
    this.body.velocity.x += (dx / len) * force;
    this.body.velocity.y += (dy / len) * force;
  }

  heal(amount: number) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  get isDead(): boolean {
    return this.health <= 0;
  }

  destroy(fromScene?: boolean): void {
    this.visual.destroy();
    super.destroy(fromScene);
  }
}
