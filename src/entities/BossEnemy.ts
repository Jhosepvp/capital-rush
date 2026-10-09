import Phaser from 'phaser';
import { Enemy, EnemyContext, EnemyKind } from './Enemy';
import { EnemyProjectile } from './EnemyProjectile';
import { BruiserEnemy } from './BruiserEnemy';
import { ShooterEnemy } from './ShooterEnemy';
import { LancerEnemy } from './LancerEnemy';
import { BOSS } from '../data/balance';
import { FX } from '../systems/FX';

type BossState = 'approach' | 'telegraphMelee' | 'telegraphRadial' | 'phase2Telegraph';

type MinionCtor = typeof BruiserEnemy | typeof ShooterEnemy | typeof LancerEnemy;

const MINION_TYPES: { kind: EnemyKind; ctor: MinionCtor }[] = [
  { kind: 'bruiser', ctor: BruiserEnemy },
  { kind: 'shooter', ctor: ShooterEnemy },
  { kind: 'lancer', ctor: LancerEnemy },
];

export class BossEnemy extends Enemy {
  phase: 1 | 2 = 1;
  private attackState: BossState = 'approach';
  private stateStartedAt = 0;

  private lastMeleeAt = -Infinity;
  private lastShootAt = -Infinity;
  private lastRadialAt = 0;
  private radialRotationDeg = 0;

  private minions: Enemy[] = [];
  private pendingReinforcementTimers: number[] = [];

  private telegraphRing: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'boss', {
      radius: BOSS.radius,
      color: BOSS.color,
      health: BOSS.health,
      speed: BOSS.speed,
      damage: 0,
      coinMin: 0,
      coinMax: 0,
    });
    this.isDangerous = true;
    this.setStrokeStyle(4, 0x0b3d24, 1);

    this.telegraphRing = scene.add.circle(x, y, BOSS.radius + 16, 0xffffff, 0);
    this.telegraphRing.setStrokeStyle(4, 0xffffff, 0);
    this.telegraphRing.setDepth(4);

    // Radial attack timer starts offset so it doesn't fire immediately on spawn.
    this.lastRadialAt = -BOSS.radialCooldown + 1800;
  }

  update(ctx: EnemyContext): void {
    const { player, time } = ctx;
    this.telegraphRing.setPosition(this.x, this.y);

    if (this.phase === 1 && this.health <= this.maxHealth * BOSS.phase2HealthRatio) {
      this.enterPhase2(time);
    }

    if (this.attackState === 'phase2Telegraph') {
      this.body.setVelocity(0, 0);
      if (time - this.stateStartedAt >= BOSS.phase2TelegraphMs) {
        this.summonInitialTrio(ctx);
        this.attackState = 'approach';
      }
      return;
    }

    if (this.attackState === 'telegraphMelee') {
      this.body.setVelocity(0, 0);
      if (time - this.stateStartedAt >= BOSS.meleeTelegraphMs) {
        this.resolveMelee(ctx);
        this.attackState = 'approach';
      }
      return;
    }

    if (this.attackState === 'telegraphRadial') {
      this.body.setVelocity(0, 0);
      if (time - this.stateStartedAt >= BOSS.radialTelegraphMs) {
        this.fireRadialBurst(ctx);
        this.attackState = 'approach';
        this.telegraphRing.setStrokeStyle(4, 0xffffff, 0);
      }
      return;
    }

    if (this.phase === 2) {
      this.processReinforcements(ctx);
    }

    // --- Normal approach: move toward player, shoot and melee opportunistically.
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;

    if (dist > BOSS.meleeRange * 0.8) {
      this.body.setVelocity((dx / dist) * this.speed, (dy / dist) * this.speed);
    } else {
      this.body.setVelocity(0, 0);
    }

    this.isAttacking = false;

    const radialCooldown = this.phase === 2 ? BOSS.radialCooldown * BOSS.phase2RadialCooldownMultiplier : BOSS.radialCooldown;
    if (time - this.lastRadialAt >= radialCooldown) {
      this.startRadialTelegraph(time);
      return;
    }

    const meleeCooldown = this.phase === 2 ? BOSS.meleeCooldown * BOSS.phase2MeleeCooldownMultiplier : BOSS.meleeCooldown;
    if (dist <= BOSS.meleeRange && time - this.lastMeleeAt >= meleeCooldown) {
      this.startMeleeTelegraph(time);
      return;
    }

    const shootCooldown = this.phase === 2 ? BOSS.shootCooldown * BOSS.phase2ShootCooldownMultiplier : BOSS.shootCooldown;
    if (time - this.lastShootAt >= shootCooldown) {
      this.shoot(ctx, dx / dist, dy / dist);
    }
  }

  private enterPhase2(time: number) {
    this.phase = 2;
    this.speed *= BOSS.phase2SpeedMultiplier;
    this.attackState = 'phase2Telegraph';
    this.stateStartedAt = time;
    this.body.setVelocity(0, 0);

    FX.flashTint(this.scene, this.visual.sprite, 0xffffff, 140);
    FX.scalePunch(this.scene, this.visual.sprite, 1.3);
    FX.screenShake(this.scene, 160, 0.004);
    FX.spriteBurst(this.scene, 'boss_phase_ring', this.x, this.y, {
      startScale: 0.3,
      endScale: 1.4,
      startAlpha: 0.9,
      endAlpha: 0,
      duration: BOSS.phase2TelegraphMs + 150,
      depth: 3,
    });
    FX.floatingText(this.scene, this.x, this.y - BOSS.radius - 20, 'MARKET PANIC', '#ff5555', '22px');
  }

  private summonInitialTrio(ctx: EnemyContext) {
    for (const { ctor } of MINION_TYPES) {
      this.summonMinion(ctx, ctor);
    }
  }

  private summonMinion(ctx: EnemyContext, Ctor: MinionCtor) {
    const angle = Math.random() * Math.PI * 2;
    const x = this.x + Math.cos(angle) * BOSS.minionSpawnRadius;
    const y = this.y + Math.sin(angle) * BOSS.minionSpawnRadius;

    const minion = new Ctor(ctx.scene, x, y);
    minion.isSummonedMinion = true;
    ctx.enemyGroup.add(minion);
    this.minions.push(minion);

    FX.hitSpark(this.scene, x, y, 0xffffff, 8);
  }

  /**
   * Prevents infinite minion farming: at most BOSS.minionMaxAlive are ever
   * alive at once, and a dead one is replaced only after an 8-10s delay
   * (scheduled by notifyMinionDefeated), never instantly.
   */
  private processReinforcements(ctx: EnemyContext) {
    this.minions = this.minions.filter((m) => m.active);
    if (this.minions.length >= BOSS.minionMaxAlive) return;
    if (this.pendingReinforcementTimers.length === 0) return;

    const dueIndex = this.pendingReinforcementTimers.findIndex((t) => ctx.time >= t);
    if (dueIndex === -1) return;

    this.pendingReinforcementTimers.splice(dueIndex, 1);
    const Ctor = this.pickReinforcementType();
    this.summonMinion(ctx, Ctor);
  }

  private pickReinforcementType(): MinionCtor {
    const aliveKinds = new Set(this.minions.map((m) => m.kind));
    const missing = MINION_TYPES.filter((t) => !aliveKinds.has(t.kind));
    const pool = missing.length > 0 ? missing : MINION_TYPES;
    return pool[Math.floor(Math.random() * pool.length)].ctor;
  }

  /** Called by GameScene when one of this boss's summoned minions dies. */
  notifyMinionDefeated(time: number) {
    this.minions = this.minions.filter((m) => m.active);
    const delay = Phaser.Math.Between(BOSS.minionReinforcementDelayMinMs, BOSS.minionReinforcementDelayMaxMs);
    this.pendingReinforcementTimers.push(time + delay);
  }

  private startMeleeTelegraph(time: number) {
    this.attackState = 'telegraphMelee';
    this.stateStartedAt = time;
    this.isAttacking = true;
    FX.scalePunch(this.scene, this.visual.sprite, 1.25);
  }

  private resolveMelee(ctx: EnemyContext) {
    const { player, time, behaviorTracker } = ctx;
    this.lastMeleeAt = time;

    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    if (dist <= BOSS.meleeRange * 1.3) {
      const mitigated = player.takeDamage(BOSS.meleeDamage, time);
      if (mitigated > 0) {
        player.applyKnockback(this.x, this.y, BOSS.meleeKnockback, time);
        FX.spriteBurst(this.scene, 'hit_red', player.x, player.y, { startScale: 0.4, endScale: 0.8, duration: 220, depth: 11 });
        FX.screenShake(this.scene, 140, 0.004);
        behaviorTracker.recordMeleeDamage(mitigated);
      }
    }
  }

  private shoot(ctx: EnemyContext, dirX: number, dirY: number) {
    const { enemyProjectiles, time } = ctx;
    this.lastShootAt = time;
    const projectile = new EnemyProjectile(
      this.scene,
      this.x,
      this.y,
      dirX,
      dirY,
      BOSS.shootProjectileSpeed,
      BOSS.shootProjectileRadius,
      BOSS.color,
      BOSS.shootDamage,
      time,
      'collector_orb'
    );
    enemyProjectiles.add(projectile);
    FX.spriteBurst(this.scene, 'muzzle_collector', this.x, this.y, {
      rotation: Math.atan2(dirY, dirX),
      startScale: 0.4,
      endScale: 0.6,
      duration: 110,
      depth: 7,
    });
  }

  private startRadialTelegraph(time: number) {
    this.attackState = 'telegraphRadial';
    this.stateStartedAt = time;
    this.isAttacking = true;
    this.telegraphRing.setStrokeStyle(4, 0xffe066, 0.9);
    FX.floatingText(this.scene, this.x, this.y - BOSS.radius - 24, 'MARKET CRASH', '#ffe066', '18px');
    FX.scalePunch(this.scene, this.telegraphRing, 1.15);
  }

  private fireRadialBurst(ctx: EnemyContext) {
    const { enemyProjectiles, time } = ctx;
    this.lastRadialAt = time;

    const count = BOSS.radialCount + (this.phase === 2 ? BOSS.phase2RadialCountBonus : 0);
    const stepDeg = 360 / count;
    this.radialRotationDeg += BOSS.radialRotationStepDeg;

    for (let i = 0; i < count; i++) {
      const angleDeg = stepDeg * i + this.radialRotationDeg;
      const angleRad = Phaser.Math.DegToRad(angleDeg);
      const dirX = Math.cos(angleRad);
      const dirY = Math.sin(angleRad);

      const projectile = new EnemyProjectile(
        this.scene,
        this.x,
        this.y,
        dirX,
        dirY,
        BOSS.radialProjectileSpeed,
        BOSS.radialProjectileRadius,
        0xffe066,
        BOSS.radialDamage,
        time,
        'collector_shard'
      );
      enemyProjectiles.add(projectile);
    }

    FX.spriteBurst(this.scene, 'muzzle_collector', this.x, this.y, {
      startScale: 0.5,
      endScale: 1.1,
      duration: 180,
      depth: 7,
    });
    FX.screenShake(this.scene, 120, 0.003);
  }

  destroy(fromScene?: boolean): void {
    this.telegraphRing.destroy();
    super.destroy(fromScene);
  }
}
