export const ARENA = {
  width: 1600,
  height: 1200,
};

export const PLAYER = {
  radius: 18,
  color: 0x3ba7ff,
  maxHealth: 100,
  moveSpeed: 220,
  knockbackForce: 180,
  hitInvulnMs: 350,
};

export const COMBAT = {
  autoAimRange: 420,
  fireCooldown: 450,
  projectileDamage: 12,
  projectileSpeed: 520,
  projectileRadius: 5,
  projectileLifetime: 1200,
  showDamageNumbers: true,
  // Visual-only scale applied to projectile sprites; the physics circle
  // (projectileRadius / each enemy's own radius) is the real hitbox and is
  // intentionally smaller than the glow art.
  projectileVisualScale: 0.45,
};

// --- Enemy archetypes -------------------------------------------------

export const BRUISER = {
  radius: 22,
  color: 0xe74c3c,
  health: 55,
  speed: 95,
  damage: 14,
  attackRange: 38,
  attackCooldown: 900,
  coinMin: 3,
  coinMax: 5,
  rushDistance: 220,
  knockbackForce: 140,
};

export const SHOOTER = {
  radius: 13,
  color: 0xf39c12,
  health: 22,
  speed: 110,
  damage: 6,
  coinMin: 5,
  coinMax: 7,
  preferredMin: 170,
  preferredMax: 260,
  fireCooldown: 1100,
  projectileSpeed: 380,
  projectileRadius: 5,
  strafeSpeedFactor: 0.7,
  strafeFlipIntervalMs: 2600,
};

export const LANCER = {
  radius: 16,
  color: 0x9b59b6,
  health: 36,
  speed: 70,
  damage: 20,
  coinMin: 7,
  coinMax: 10,
  preferredMin: 260,
  preferredMax: 380,
  throwCooldown: 2600,
  windupMs: 500,
  projectileSpeed: 240,
  projectileRadius: 7,
  basePrediction: 0.35,
};

export const BOSS = {
  name: 'THE COLLECTOR',
  radius: 46,
  color: 0x2ecc71,
  health: 900,
  speed: 70,
  coinReward: 60,

  meleeDamage: 26,
  meleeRange: 70,
  meleeCooldown: 2200,
  meleeTelegraphMs: 500,
  meleeKnockback: 220,

  shootDamage: 14,
  shootCooldown: 1400,
  shootProjectileSpeed: 300,
  shootProjectileRadius: 7,

  radialCooldown: 5000,
  radialTelegraphMs: 700,
  radialCount: 8,
  radialDamage: 12,
  radialProjectileSpeed: 260,
  radialProjectileRadius: 6,
  radialRotationStepDeg: 18,

  phase2HealthRatio: 0.5,
  phase2TelegraphMs: 900,
  phase2SpeedMultiplier: 1.12,
  phase2ShootCooldownMultiplier: 0.75,
  phase2MeleeCooldownMultiplier: 0.82,
  phase2RadialCooldownMultiplier: 0.75,
  phase2RadialCountBonus: 2,

  // Phase 2 reinforcements: the boss summons the three archetypes the
  // player already fought, reusing their existing behaviors untouched.
  minionMaxAlive: 3,
  minionReinforcementDelayMinMs: 8000,
  minionReinforcementDelayMaxMs: 10000,
  minionSpawnRadius: 120,
};

// --- Round composition --------------------------------------------------

export interface RoundComposition {
  bruiser: number;
  shooter: number;
  lancer: number;
  maxConcurrentLancer: number;
}

export const ROUND = {
  count: 3,
  spawnIntervalMs: 1300,
  crateCount: 4,
  // Rounds end once the composition is cleared, but this is a safety net
  // so a round can never drag on forever.
  safetyDurationMs: 50000,
};

export const ROUND_COMPOSITIONS: Record<number, RoundComposition> = {
  1: { bruiser: 6, shooter: 3, lancer: 1, maxConcurrentLancer: 1 },
  2: { bruiser: 5, shooter: 5, lancer: 3, maxConcurrentLancer: 2 },
};

// --- Adaptive AI ----------------------------------------------------------

export const ADAPTATION = {
  // how far distance has to average before shooters are told to close in
  highAvgDistanceThreshold: 260,
  shooterApproachBonusMax: 45,

  edgeTimeRatioThreshold: 0.45,
  lateralEntryBiasMax: 0.6,

  circlingScoreThreshold: 0.5,
  lancerPredictionBonusMax: 0.18,

  stationaryRatioThreshold: 0.35,
  rangedDamageBonusMax: 0.2,
};

// --- Economy ----------------------------------------------------------

export const ECONOMY = {
  startingMoney: 0,
  savingsYield: 0.03,
  investVariancePresets: [0.25, 0.5, 1],
};

export const INVEST_OUTCOMES = [
  { pct: -0.25, weight: 1 },
  { pct: -0.15, weight: 3 },
  { pct: -0.05, weight: 5 },
  { pct: 0.1, weight: 5 },
  { pct: 0.2, weight: 3 },
  { pct: 0.35, weight: 1 },
];

export interface EquipmentDef {
  id: 'pistol' | 'fireRate' | 'armor' | 'insurance';
  name: string;
  price: number;
  effect: string;
  icon: string;
}

export const EQUIPMENT: EquipmentDef[] = [
  { id: 'pistol', name: 'Pistola Mejorada', price: 40, effect: '+30% daño', icon: 'GUN' },
  { id: 'fireRate', name: 'Cadencia Mejorada', price: 35, effect: '+20% vel. disparo', icon: 'RATE' },
  { id: 'armor', name: 'Armadura', price: 30, effect: '-18% daño recibido', icon: 'ARM' },
  { id: 'insurance', name: 'Seguro de Emergencia', price: 22, effect: 'Cura 1 vez bajo 25% vida', icon: 'INS' },
];

export const EQUIPMENT_EFFECTS = {
  pistolDamageBonus: 0.3,
  fireRateBonus: 0.2,
  armorReduction: 0.18,
  insuranceThreshold: 0.25,
  insuranceHeal: 30,
};

// --- Crates -------------------------------------------------------------

export const COIN_MAGNET = {
  range: 90,
  speed: 260,
};

export const CRATE = {
  radius: 20,
  color: 0x6b7280,
  coinChance: 0.6,
  healChance: 0.25,
  buffChance: 0.15,
  coinMin: 3,
  coinMax: 8,
  healAmount: 10,
  buffDurationMs: 8000,
  buffDamageMultiplier: 1.3,
};

// --- Score & rank --------------------------------------------------------

export const SCORE = {
  perKill: 100,
  bossDefeatedBonus: 2000,
  perSurvivalSecond: 2,
  perRoundSurvivedBonus: 150,
  difficultyMultiplier: 2.0,
  difficultyStars: 4,
};

export const FINANCIAL_PROFILE = {
  dominantShareThreshold: 0.45,
  highShareThreshold: 0.45,
  lowShareThreshold: 0.15,
};

export const RANKS: { min: number; label: string }[] = [
  { min: 10000, label: 'S' },
  { min: 7500, label: 'A' },
  { min: 5000, label: 'B' },
  { min: 3000, label: 'C' },
  { min: 0, label: 'D' },
];

// --- Shared UI palette ---------------------------------------------------
// Sci-fi arcade HUD: dark navy base, cyan frames/highlights, gold for
// important values, red for danger, purple for investing, green for saving.
export const UI_COLORS = {
  bg: 0x0a0e16,
  panelBg: 0x0d1420,
  panelBorder: 0x1b5f72,
  cyanDark: 0x12404f,
  cyanBright: 0x4ce0ff,
  gold: 0xffd54a,
  danger: 0xff5a5a,
  invest: 0xa55eea,
  save: 0x2ecc71,
  textPrimary: '#e8f4f8',
  textDim: '#7f93a0',
  textCyan: '#4ce0ff',
  textGold: '#ffd54a',
  textDanger: '#ff5a5a',
  textInvest: '#c186f0',
  textSave: '#4ce08a',
  disabled: 0x2a3038,
};

export const STORAGE_KEYS = {
  bestScore: 'capitalRush_bestScore',
  achievements: 'capitalRush_achievements',
};
