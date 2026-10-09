import { Player } from '../entities/Player';
import { ARENA, ADAPTATION } from '../data/balance';
import { AdaptationSnapshot } from '../data/GameState';

const EDGE_MARGIN = 160;
const STATIONARY_SPEED = 20;
const DIRECTION_CHANGE_ANGLE = Math.PI / 2;

/**
 * Cheap per-round telemetry on how the player actually plays — no ML, just
 * running averages/ratios sampled every frame. GameScene reads
 * `computeAdaptation()` at round end and feeds small, clamped nudges into
 * next round's enemy spawner/behavior so enemies feel like they're
 * reacting to the player without ever cheating (nothing here looks at
 * future player input).
 */
export class PlayerBehaviorTracker {
  private totalTimeMs = 0;
  private edgeTimeMs = 0;
  private stationaryTimeMs = 0;
  private directionChangeCount = 0;
  private netRotation = 0;

  private distanceSum = 0;
  private distanceSamples = 0;

  private meleeDamageTaken = 0;
  private projectileDamageTaken = 0;

  private lastVelocityAngle: number | null = null;

  reset() {
    this.totalTimeMs = 0;
    this.edgeTimeMs = 0;
    this.stationaryTimeMs = 0;
    this.directionChangeCount = 0;
    this.netRotation = 0;
    this.distanceSum = 0;
    this.distanceSamples = 0;
    this.meleeDamageTaken = 0;
    this.projectileDamageTaken = 0;
    this.lastVelocityAngle = null;
  }

  recordMeleeDamage(amount: number) {
    this.meleeDamageTaken += amount;
  }

  recordProjectileDamage(amount: number) {
    this.projectileDamageTaken += amount;
  }

  sample(player: Player, enemies: { x: number; y: number }[], delta: number) {
    this.totalTimeMs += delta;

    const nearEdge =
      player.x < EDGE_MARGIN ||
      player.x > ARENA.width - EDGE_MARGIN ||
      player.y < EDGE_MARGIN ||
      player.y > ARENA.height - EDGE_MARGIN;
    if (nearEdge) this.edgeTimeMs += delta;

    const speed = Math.hypot(player.body.velocity.x, player.body.velocity.y);
    if (speed < STATIONARY_SPEED) {
      this.stationaryTimeMs += delta;
    } else {
      const angle = Math.atan2(player.body.velocity.y, player.body.velocity.x);
      if (this.lastVelocityAngle !== null) {
        let diff = angle - this.lastVelocityAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.netRotation += diff;
        if (Math.abs(diff) > DIRECTION_CHANGE_ANGLE) this.directionChangeCount += 1;
      }
      this.lastVelocityAngle = angle;
    }

    if (enemies.length > 0) {
      let sum = 0;
      for (const e of enemies) sum += Math.hypot(e.x - player.x, e.y - player.y);
      this.distanceSum += sum / enemies.length;
      this.distanceSamples += 1;
    }
  }

  computeAdaptation(): AdaptationSnapshot {
    const avgDistance = this.distanceSamples > 0 ? this.distanceSum / this.distanceSamples : 0;
    const edgeRatio = this.totalTimeMs > 0 ? this.edgeTimeMs / this.totalTimeMs : 0;
    const stationaryRatio = this.totalTimeMs > 0 ? this.stationaryTimeMs / this.totalTimeMs : 0;
    const circlingScore =
      this.totalTimeMs > 0 ? Math.min(1, Math.abs(this.netRotation) / ((this.totalTimeMs / 1000) * Math.PI)) : 0;

    const shooterApproachBonus = clamp01(
      (avgDistance - ADAPTATION.highAvgDistanceThreshold) / ADAPTATION.highAvgDistanceThreshold
    );
    const lateralEntryBias = clamp01((edgeRatio - ADAPTATION.edgeTimeRatioThreshold) / 0.3);
    const lancerPredictionBonus = clamp01((circlingScore - ADAPTATION.circlingScoreThreshold) / 0.4);
    const rangedDamageBonus = clamp01((stationaryRatio - ADAPTATION.stationaryRatioThreshold) / 0.4);

    return { shooterApproachBonus, lateralEntryBias, lancerPredictionBonus, rangedDamageBonus };
  }

  getDamageSplit() {
    return { melee: this.meleeDamageTaken, projectile: this.projectileDamageTaken };
  }
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
