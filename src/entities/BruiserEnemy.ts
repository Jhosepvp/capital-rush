import Phaser from 'phaser';
import { Enemy, EnemyContext } from './Enemy';
import { BRUISER } from '../data/balance';
import { FX } from '../systems/FX';

/**
 * Melee brute. When ranged allies (Shooter/Lancer) are alive, it tries to
 * approach the player from behind them (simple steering, not real
 * pathfinding) instead of beelining — once close enough it abandons that
 * cover-seeking and rushes the player directly, with a little lateral
 * jitter so it doesn't read as a straight line.
 */
export class BruiserEnemy extends Enemy {
  private readonly flankSeed = Math.random() * Math.PI * 2;

  constructor(scene: Phaser.Scene, x: number, y: number, healthMultiplier = 1, damageMultiplier = 1) {
    super(scene, x, y, 'bruiser', {
      radius: BRUISER.radius,
      color: BRUISER.color,
      health: Math.round(BRUISER.health * healthMultiplier),
      speed: BRUISER.speed,
      damage: Math.round(BRUISER.damage * damageMultiplier),
      coinMin: BRUISER.coinMin,
      coinMax: BRUISER.coinMax,
    });
    this.attackCooldown = BRUISER.attackCooldown;
  }

  update(ctx: EnemyContext): void {
    const { player, enemies, time, behaviorTracker } = ctx;
    if (this.isKnockedBack(time)) return;

    const toPlayer = new Phaser.Math.Vector2(player.x - this.x, player.y - this.y);
    const distToPlayer = toPlayer.length();

    let targetX = player.x;
    let targetY = player.y;

    if (distToPlayer > BRUISER.rushDistance) {
      const cover = this.findCover(enemies, toPlayer, distToPlayer);
      if (cover) {
        targetX = cover.x;
        targetY = cover.y;
      }
    }

    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const len = Math.hypot(dx, dy) || 1;

    // Slight flank jitter perpendicular to the travel direction.
    const jitter = Math.sin(time / 320 + this.flankSeed) * 0.35;
    const vx = dx / len + (-dy / len) * jitter;
    const vy = dy / len + (dx / len) * jitter;
    const vlen = Math.hypot(vx, vy) || 1;

    this.body.setVelocity((vx / vlen) * this.speed, (vy / vlen) * this.speed);

    this.isAttacking = false;
    if (distToPlayer <= BRUISER.attackRange && this.canAttack(time)) {
      this.isAttacking = true;
      this.markAttacked(time);
      const mitigated = player.takeDamage(this.damage, time);
      if (mitigated > 0) {
        player.applyKnockback(this.x, this.y, BRUISER.knockbackForce, time);
        FX.spriteBurst(this.scene, 'hit_red', player.x, player.y, { startScale: 0.35, endScale: 0.7, duration: 200, depth: 11 });
        FX.screenShake(this.scene, 90, 0.0025);
        behaviorTracker.recordMeleeDamage(mitigated);
      }
    }
  }

  private findCover(
    enemies: Enemy[],
    toPlayer: Phaser.Math.Vector2,
    distToPlayer: number
  ): { x: number; y: number } | null {
    const toPlayerNorm = toPlayer.clone().normalize();
    let best: Enemy | null = null;
    let bestScore = -Infinity;

    for (const other of enemies) {
      if (other === this || !other.active) continue;
      if (other.kind !== 'shooter' && other.kind !== 'lancer') continue;

      const toAlly = new Phaser.Math.Vector2(other.x - this.x, other.y - this.y);
      const allyDist = toAlly.length();
      if (allyDist >= distToPlayer) continue;

      const dot = toAlly.clone().normalize().dot(toPlayerNorm);
      if (dot < 0.4) continue;

      const score = dot - allyDist / 1000;
      if (score > bestScore) {
        bestScore = score;
        best = other;
      }
    }

    if (!best) return null;
    return { x: best.x, y: best.y };
  }
}
