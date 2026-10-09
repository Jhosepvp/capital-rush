import Phaser from 'phaser';

const DIRECTIONS = ['down', 'up', 'left', 'right'];
const POSES = ['idle', 'walk_1', 'walk_2', 'attack'];
export const CHARACTER_KEYS = ['player', 'bruiser', 'shooter', 'lancer', 'collector'];

export const PROJECTILE_KEYS = ['player_projectile', 'shooter_projectile', 'lancer_projectile', 'collector_orb', 'collector_shard'];
export const PICKUP_KEYS = ['credit_small', 'credit_large', 'health_pickup', 'insurance_pickup', 'buff_pickup'];
export const PROP_KEYS = [
  'cash_crate',
  'cash_crate_destroyed',
  'reinforced_crate_red',
  'reinforced_crate_gold',
  'barrier_cyan',
  'barrier_magenta',
  'energy_generator',
  'energy_barrier',
  'terminal_cyan',
  'terminal_red',
  'cargo_container',
  'debris_crate',
  'debris_crate_destroyed',
  'pylon_cyan',
  'pylon_red',
];
export const VFX_KEYS = [
  'muzzle_player',
  'muzzle_shooter',
  'muzzle_lancer',
  'muzzle_collector',
  'hit_red',
  'hit_cyan',
  'hit_magenta',
  'enemy_death',
  'explosion_small',
  'credit_pickup_fx',
  'health_pickup_fx',
  'boss_phase_ring',
];

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    for (const character of CHARACTER_KEYS) {
      this.load.json(`${character}_meta`, `assets/sprites/${character}/meta.json`);
      for (const direction of DIRECTIONS) {
        for (const pose of POSES) {
          const name = `${direction}_${pose}`;
          this.load.image(`${character}_${name}`, `assets/sprites/${character}/${name}.png`);
        }
      }
    }

    this.load.image('arena_bg', 'assets/environment/arena_background.png');

    for (const key of PROJECTILE_KEYS) this.load.image(key, `assets/projectiles/${key}.png`);
    for (const key of PICKUP_KEYS) this.load.image(key, `assets/pickups/${key}.png`);
    for (const key of PROP_KEYS) this.load.image(key, `assets/props/${key}.png`);
    for (const key of VFX_KEYS) this.load.image(key, `assets/vfx/${key}.png`);
  }

  create() {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture('particle', 8, 8);
    g.destroy();

    this.scene.start('Menu');
  }
}
