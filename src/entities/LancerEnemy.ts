import Phaser from 'phaser';
import { Enemy, EnemyContext } from './Enemy';
import { EnemyProjectile } from './EnemyProjectile';
import { LANCER, ADAPTATION } from '../data/balance';
import { FX } from '../systems/FX';

type LancerState = 'idle' | 'windup';

/**
 * Ranged skirmisher that holds a preferred distance (retreats if the player
 * closes in, advances if they're too far) and telegraphs its throw with a
 * brief wind-up before lobbing a projectile at a *predicted* position
 * instead of the player's current spot.
 */
export class LancerEnemy extends Enemy {
  private attackState: LancerState = 'idle';
  private windupStartedAt = 0;
  private lastThrowAt = -Infinity;

  constructor(scene: Phaser.Scene, x: number, y: number, healthMultiplier = 1, damageMultiplier = 1) {
    super(scene, x, y, 'lancer', {
      radius: LANCER.radius,
      color: LANCER.color,
      health: Math.round(LANCER.health * healthMultiplier),
      speed: LANCER.speed,
      damage: Math.round(LANCER.damage * damageMultiplier),
      coinMin: LANCER.coinMin,
      coinMax: LANCER.coinMax,
    });
    this.isDangerous = true;
    this.attackCooldown = LANCER.throwCooldown;
  }

  update(ctx: EnemyContext): void {
    const { player, time } = ctx;
    if (this.isKnockedBack(time)) return;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;

    if (this.attackState === 'windup') {
      // Hold position while telegraphing; only move defensively if the
      // player suddenly closes the gap.
      this.body.setVelocity(0, 0);

      if (time - this.windupStartedAt >= LANCER.windupMs) {
        this.throwLance(ctx, dx / dist, dy / dist);
        this.attackState = 'idle';
        this.isAttacking = false;
      }
      return;
    }

    if (dist < LANCER.preferredMin) {
      this.body.setVelocity((-dx / dist) * this.speed, (-dy / dist) * this.speed);
    } else if (dist > LANCER.preferredMax) {
      this.body.setVelocity((dx / dist) * this.speed, (dy / dist) * this.speed);
    } else {
      this.body.setVelocity(0, 0);
    }

    if (time - this.lastThrowAt >= LANCER.throwCooldown && dist <= LANCER.preferredMax * 1.1) {
      this.attackState = 'windup';
      this.windupStartedAt = time;
      this.isAttacking = true;
      FX.scalePunch(this.scene, this.visual.sprite, 1.3);
    }
  }

  private throwLance(ctx: EnemyContext, dirXFallback: number, dirYFallback: number) {
    const { player, enemyProjectiles, time, adaptation } = ctx;
    this.lastThrowAt = time;

    const predictionFactor =
      LANCER.basePrediction + adaptation.lancerPredictionBonus * ADAPTATION.lancerPredictionBonusMax;

    const predictedX = player.x + player.body.velocity.x * predictionFactor;
    const predictedY = player.y + player.body.velocity.y * predictionFactor;

    let dx = predictedX - this.x;
    let dy = predictedY - this.y;
    let len = Math.hypot(dx, dy);
    if (len < 1) {
      dx = dirXFallback;
      dy = dirYFallback;
      len = 1;
    }

    const projectile = new EnemyProjectile(
      this.scene,
      this.x,
      this.y,
      dx / len,
      dy / len,
      LANCER.projectileSpeed,
      LANCER.projectileRadius,
      LANCER.color,
      this.damage,
      time,
      'lancer_projectile'
    );
    enemyProjectiles.add(projectile);
    FX.spriteBurst(this.scene, 'muzzle_lancer', this.x, this.y, {
      rotation: Math.atan2(dy, dx),
      startScale: 0.35,
      endScale: 0.5,
      duration: 100,
      depth: 7,
    });
  }
}
