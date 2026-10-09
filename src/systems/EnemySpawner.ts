import Phaser from 'phaser';
import { Enemy } from '../entities/Enemy';
import { BruiserEnemy } from '../entities/BruiserEnemy';
import { ShooterEnemy } from '../entities/ShooterEnemy';
import { LancerEnemy } from '../entities/LancerEnemy';
import { ROUND_COMPOSITIONS } from '../data/balance';
import { AdaptationSnapshot } from '../data/GameState';

type EnemyTypeTag = 'bruiser' | 'shooter' | 'lancer';

export class EnemySpawner {
  private queue: EnemyTypeTag[] = [];

  constructor(
    private scene: Phaser.Scene,
    private arenaWidth: number,
    private arenaHeight: number
  ) {}

  /** Builds an interleaved spawn queue for the round's composition. */
  prepareRound(round: number) {
    const comp = ROUND_COMPOSITIONS[round];
    this.queue = [];
    if (!comp) return;

    const pools: { tag: EnemyTypeTag; count: number }[] = [
      { tag: 'bruiser', count: comp.bruiser },
      { tag: 'shooter', count: comp.shooter },
      { tag: 'lancer', count: comp.lancer },
    ];

    // Round-robin interleave so the three types trickle in mixed, not in blocks.
    let remaining = pools.reduce((sum, p) => sum + p.count, 0);
    while (remaining > 0) {
      for (const pool of pools) {
        if (pool.count > 0) {
          this.queue.push(pool.tag);
          pool.count -= 1;
          remaining -= 1;
        }
      }
    }
  }

  get pending(): number {
    return this.queue.length;
  }

  maxConcurrentLancer(round: number): number {
    return ROUND_COMPOSITIONS[round]?.maxConcurrentLancer ?? 1;
  }

  spawnNext(
    round: number,
    focusX: number,
    focusY: number,
    livingEnemies: Enemy[],
    adaptation: AdaptationSnapshot,
    healthMultiplier: number,
    damageMultiplier: number
  ): Enemy | null {
    if (this.queue.length === 0) return null;

    const nextTag = this.queue[0];
    if (nextTag === 'lancer') {
      const liveLancers = livingEnemies.filter((e) => e.kind === 'lancer').length;
      if (liveLancers >= this.maxConcurrentLancer(round)) {
        // Hold this lancer back; try other types first by rotating it to the back.
        this.queue.push(this.queue.shift()!);
        if (this.queue.every((t) => t === 'lancer')) return null;
        return this.spawnNext(round, focusX, focusY, livingEnemies, adaptation, healthMultiplier, damageMultiplier);
      }
    }

    this.queue.shift();

    const lateralBias = adaptation.lateralEntryBias;
    const angle = this.pickSpawnAngle(focusX, focusY, lateralBias);
    const distance = 420 + Math.random() * 180;

    const x = Phaser.Math.Clamp(focusX + Math.cos(angle) * distance, 40, this.arenaWidth - 40);
    const y = Phaser.Math.Clamp(focusY + Math.sin(angle) * distance, 40, this.arenaHeight - 40);

    switch (nextTag) {
      case 'bruiser':
        return new BruiserEnemy(this.scene, x, y, healthMultiplier, damageMultiplier);
      case 'shooter':
        return new ShooterEnemy(this.scene, x, y, healthMultiplier, damageMultiplier);
      case 'lancer':
        return new LancerEnemy(this.scene, x, y, healthMultiplier, damageMultiplier);
    }
  }

  /**
   * When the adaptive AI detects the player hugging the arena edges, bias
   * spawns toward lateral angles (left/right of the player's usual facing)
   * rather than a pure uniform circle.
   */
  private pickSpawnAngle(_focusX: number, _focusY: number, lateralBias: number): number {
    const uniform = Math.random() * Math.PI * 2;
    if (Math.random() > lateralBias) return uniform;

    const lateralChoices = [Math.PI / 2, -Math.PI / 2, (Math.PI / 2) * 3, -(Math.PI / 2) * 1.5];
    const base = lateralChoices[Math.floor(Math.random() * lateralChoices.length)];
    return base + (Math.random() - 0.5) * 0.6;
  }
}
