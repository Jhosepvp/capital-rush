import Phaser from 'phaser';
import { Enemy, EnemyContext } from './Enemy';
import { EnemyProjectile } from './EnemyProjectile';
import { SHOOTER, ADAPTATION } from '../data/balance';
import { FX } from '../systems/FX';

/**
 * Ranged harasser. Closes in to a preferred band, then strafes around the
 * player instead of standing still or walking straight at them.
 */
export class ShooterEnemy extends Enemy {
  private strafeDir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  private lastFlipAt = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, healthMultiplier = 1, damageMultiplier = 1) {
    super(scene, x, y, 'shooter', {
      radius: SHOOTER.radius,
      color: SHOOTER.color,
      health: Math.round(SHOOTER.health * healthMultiplier),
      speed: SHOOTER.speed,
      damage: Math.round(SHOOTER.damage * damageMultiplier),
      coinMin: SHOOTER.coinMin,
      coinMax: SHOOTER.coinMax,
    });
    this.attackCooldown = SHOOTER.fireCooldown;
  }

  update(ctx: EnemyContext): void {
    const { player, enemyProjectiles, time, adaptation } = ctx;
    if (this.isKnockedBack(time)) return;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;

    const approachBonus = adaptation.shooterApproachBonus * ADAPTATION.shooterApproachBonusMax;
    const min = SHOOTER.preferredMin - approachBonus;
    const max = SHOOTER.preferredMax - approachBonus;

    if (time - this.lastFlipAt > SHOOTER.strafeFlipIntervalMs) {
      this.lastFlipAt = time;
      if (Math.random() < 0.5) this.strafeDir = this.strafeDir === 1 ? -1 : 1;
    }

    let vx: number;
    let vy: number;

    if (dist > max) {
      vx = dx / dist;
      vy = dy / dist;
    } else if (dist < min) {
      vx = -dx / dist;
      vy = -dy / dist;
    } else {
      // Strafe tangentially around the player.
      vx = (-dy / dist) * this.strafeDir;
      vy = (dx / dist) * this.strafeDir;
    }

    const speedFactor = dist >= min && dist <= max ? SHOOTER.strafeSpeedFactor : 1;
    this.body.setVelocity(vx * this.speed * speedFactor, vy * this.speed * speedFactor);

    this.isAttacking = false;
    if (this.canAttack(time)) {
      this.isAttacking = true;
      this.markAttacked(time);

      const rangedDamageBonus = 1 + adaptation.rangedDamageBonus * ADAPTATION.rangedDamageBonusMax;
      const projectile = new EnemyProjectile(
        this.scene,
        this.x,
        this.y,
        dx / dist,
        dy / dist,
        SHOOTER.projectileSpeed,
        SHOOTER.projectileRadius,
        SHOOTER.color,
        this.damage * rangedDamageBonus,
        time,
        'shooter_projectile'
      );
      enemyProjectiles.add(projectile);
      FX.spriteBurst(this.scene, 'muzzle_shooter', this.x, this.y, {
        rotation: Math.atan2(dy, dx),
        startScale: 0.3,
        endScale: 0.45,
        duration: 90,
        depth: 7,
      });
    }
  }
}
