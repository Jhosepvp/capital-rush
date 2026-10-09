import Phaser from 'phaser';
import { Player } from './Player';
import { FX } from '../systems/FX';
import { AdaptationSnapshot } from '../data/GameState';
import { PlayerBehaviorTracker } from '../systems/PlayerBehaviorTracker';
import { CharacterVisual, SpriteMeta } from './CharacterVisual';

export interface EnemyContext {
  scene: Phaser.Scene;
  player: Player;
  enemies: Enemy[];
  enemyGroup: Phaser.GameObjects.Group;
  enemyProjectiles: Phaser.GameObjects.Group;
  adaptation: AdaptationSnapshot;
  behaviorTracker: PlayerBehaviorTracker;
  time: number;
  delta: number;
}

export type EnemyKind = 'bruiser' | 'shooter' | 'lancer' | 'boss';

/** Enemy.kind -> sprite folder name (the boss's art is "collector"). */
const SPRITE_CHARACTER: Record<EnemyKind, string> = {
  bruiser: 'bruiser',
  shooter: 'shooter',
  lancer: 'lancer',
  boss: 'collector',
};

export interface EnemyStats {
  radius: number;
  color: number;
  health: number;
  speed: number;
  damage: number;
  coinMin: number;
  coinMax: number;
}

export abstract class Enemy extends Phaser.GameObjects.Arc {
  declare body: Phaser.Physics.Arcade.Body;

  readonly kind: EnemyKind;
  health: number;
  maxHealth: number;
  speed: number;
  damage: number;
  coinMin: number;
  coinMax: number;

  /** Targeting hints consumed by CombatSystem's priority auto-aim. */
  isDangerous = false;
  isAttacking = false;

  /** True for enemies summoned by the boss in phase 2 — see GameScene. */
  isSummonedMinion = false;

  lastAttackAt = -Infinity;
  attackCooldown = 800;
  private knockbackUntilTime = 0;
  readonly visual: CharacterVisual;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: EnemyKind, stats: EnemyStats) {
    super(scene, x, y, stats.radius, 0, 360, false, stats.color, 1);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setCircle(stats.radius);
    this.body.setCollideWorldBounds(true);
    this.setDepth(5);
    // The Arc stays as the (invisible) physics body — the sprite is the
    // only thing actually drawn, so collision/balance is untouched.
    this.setVisible(false);

    this.kind = kind;
    this.health = stats.health;
    this.maxHealth = stats.health;
    this.speed = stats.speed;
    this.damage = stats.damage;
    this.coinMin = stats.coinMin;
    this.coinMax = stats.coinMax;

    const character = SPRITE_CHARACTER[kind];
    const meta = scene.cache.json.get(`${character}_meta`) as SpriteMeta;
    this.visual = new CharacterVisual(scene, character, x, y, meta, 5);
  }

  get coinValue(): number {
    return Phaser.Math.Between(this.coinMin, this.coinMax);
  }

  isKnockedBack(time: number): boolean {
    return time < this.knockbackUntilTime;
  }

  applyKnockback(fromX: number, fromY: number, force: number, time: number, durationMs = 120) {
    const dx = this.x - fromX;
    const dy = this.y - fromY;
    const len = Math.hypot(dx, dy) || 1;
    this.body.setVelocity((dx / len) * force, (dy / len) * force);
    this.knockbackUntilTime = time + durationMs;
  }

  canAttack(time: number): boolean {
    return time - this.lastAttackAt >= this.attackCooldown;
  }

  markAttacked(time: number) {
    this.lastAttackAt = time;
  }

  /** Visual hit feedback shared by every enemy type. */
  takeDamage(amount: number): boolean {
    this.health -= amount;
    FX.flashTint(this.scene, this.visual.sprite, 0xffffff);
    FX.scalePunch(this.scene, this.visual.sprite);
    return this.health <= 0;
  }

  /** Call once per frame (GameScene) to sync the sprite to the physics body and pose it. */
  syncVisual(time: number) {
    this.visual.update(this.x, this.y, this.body.velocity.x, this.body.velocity.y, time);
  }

  destroy(fromScene?: boolean): void {
    this.visual.destroy();
    super.destroy(fromScene);
  }

  abstract update(ctx: EnemyContext): void;
}
