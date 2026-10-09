import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Projectile } from '../entities/Projectile';
import { COMBAT, CRATE } from '../data/balance';
import { GameState } from '../data/GameState';
import { FX } from '../systems/FX';

export class CombatSystem {
  private lastShotAt = 0;

  constructor(
    private scene: Phaser.Scene,
    private player: Player,
    private enemies: Phaser.GameObjects.Group,
    private projectiles: Phaser.GameObjects.Group
  ) {}

  /**
   * Priority auto-target: a nearby dangerous enemy beats one that's
   * currently mid-attack, which beats the plain nearest enemy. Keeps the
   * aim logic simple while still rewarding players who notice threats.
   */
  findTarget(): Enemy | null {
    let bestDangerous: Enemy | null = null;
    let bestDangerousDist = COMBAT.autoAimRange;
    let bestAttacking: Enemy | null = null;
    let bestAttackingDist = COMBAT.autoAimRange;
    let bestAny: Enemy | null = null;
    let bestAnyDist = COMBAT.autoAimRange;

    for (const obj of this.enemies.getChildren()) {
      const enemy = obj as Enemy;
      if (!enemy.active) continue;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      if (dist >= COMBAT.autoAimRange) continue;

      if (enemy.isDangerous && dist < bestDangerousDist) {
        bestDangerousDist = dist;
        bestDangerous = enemy;
      }
      if (enemy.isAttacking && dist < bestAttackingDist) {
        bestAttackingDist = dist;
        bestAttacking = enemy;
      }
      if (dist < bestAnyDist) {
        bestAnyDist = dist;
        bestAny = enemy;
      }
    }

    return bestDangerous ?? bestAttacking ?? bestAny;
  }

  update(time: number) {
    const target = this.findTarget();
    const fireCooldown = COMBAT.fireCooldown * GameState.fireRateMultiplier;

    if (target && time - this.lastShotAt >= fireCooldown) {
      this.lastShotAt = time;
      const dx = target.x - this.player.x;
      const dy = target.y - this.player.y;
      const len = Math.hypot(dx, dy) || 1;

      this.player.triggerAttackVisual(dx, dy, time);

      const buffActive = time < GameState.tempDamageBuffUntil;
      const damage =
        COMBAT.projectileDamage * GameState.damageMultiplier * (buffActive ? CRATE.buffDamageMultiplier : 1);

      const projectile = new Projectile(
        this.scene,
        this.player.x,
        this.player.y,
        dx / len,
        dy / len,
        damage,
        time
      );
      this.projectiles.add(projectile);

      FX.spriteBurst(this.scene, 'muzzle_player', this.player.x, this.player.y, {
        rotation: Math.atan2(dy, dx),
        startScale: 0.3,
        endScale: 0.45,
        duration: 90,
        depth: 11,
      });
    }

    for (const obj of this.projectiles.getChildren()) {
      const projectile = obj as Projectile;
      if (projectile.isExpired(time)) {
        projectile.destroy();
      } else {
        projectile.syncVisual();
      }
    }
  }
}
