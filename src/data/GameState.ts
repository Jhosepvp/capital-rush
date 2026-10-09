import { ECONOMY, PLAYER, STORAGE_KEYS } from './balance';

export interface AdaptationSnapshot {
  shooterApproachBonus: number;
  lateralEntryBias: number;
  lancerPredictionBonus: number;
  rangedDamageBonus: number;
}

const ZERO_ADAPTATION: AdaptationSnapshot = {
  shooterApproachBonus: 0,
  lateralEntryBias: 0,
  lancerPredictionBonus: 0,
  rangedDamageBonus: 0,
};

export interface PurchaseRecord {
  round: number;
  itemId: string;
  itemName: string;
  price: number;
  effect: string;
}

export interface InvestmentRecord {
  round: number;
  invested: number;
  returnRate: number;
  returnedAmount: number;
  profitLoss: number;
}

export interface SavingsRecord {
  round: number;
  amountBefore: number;
  interest: number;
}

export interface CapitalSnapshot {
  label: string;
  amount: number;
}

class GameStateStore {
  money = ECONOMY.startingMoney;
  maxHealth = PLAYER.maxHealth;
  damageReduction = 0;
  damageMultiplier = 1;
  fireRateMultiplier = 1;

  equipmentBought = new Set<string>();
  insuranceActive = false;
  insuranceUsed = false;
  tempDamageBuffUntil = 0;

  currentRound = 0;
  kills = 0;
  bossDefeated = false;
  moneyEarnedTotal = 0;
  survivalMs = 0;
  roundsCompleted = 0;
  adaptation: AdaptationSnapshot = { ...ZERO_ADAPTATION };

  // --- Structured financial data (EconomySystem is the only writer) -----
  equipmentSpent = 0;
  totalInvested = 0;
  investmentReturns = 0;
  investmentProfitLoss = 0;
  totalSaved = 0;
  savingsInterest = 0;
  purchases: PurchaseRecord[] = [];
  investments: InvestmentRecord[] = [];
  savings: SavingsRecord[] = [];
  capitalHistory: CapitalSnapshot[] = [];

  reset() {
    this.money = ECONOMY.startingMoney;
    this.maxHealth = PLAYER.maxHealth;
    this.damageReduction = 0;
    this.damageMultiplier = 1;
    this.fireRateMultiplier = 1;

    this.equipmentBought = new Set<string>();
    this.insuranceActive = false;
    this.insuranceUsed = false;
    this.tempDamageBuffUntil = 0;

    this.currentRound = 0;
    this.kills = 0;
    this.bossDefeated = false;
    this.moneyEarnedTotal = 0;
    this.survivalMs = 0;
    this.roundsCompleted = 0;
    this.adaptation = { ...ZERO_ADAPTATION };

    this.equipmentSpent = 0;
    this.totalInvested = 0;
    this.investmentReturns = 0;
    this.investmentProfitLoss = 0;
    this.totalSaved = 0;
    this.savingsInterest = 0;
    this.purchases = [];
    this.investments = [];
    this.savings = [];
    this.capitalHistory = [];
  }

  snapshotCapital(label: string) {
    this.capitalHistory.push({ label, amount: Math.round(this.money) });
  }
}

export const GameState = new GameStateStore();

export function getBestScore(): number {
  const raw = localStorage.getItem(STORAGE_KEYS.bestScore);
  return raw ? Number(raw) || 0 : 0;
}

export function setBestScore(score: number) {
  try {
    localStorage.setItem(STORAGE_KEYS.bestScore, String(Math.round(score)));
  } catch {
    // Storage disabled (private browsing, quota exceeded, etc.) — the
    // record just won't persist this run, nothing in-game depends on it.
  }
}

export function getUnlockedAchievements(): Set<string> {
  const raw = localStorage.getItem(STORAGE_KEYS.achievements);
  if (!raw) return new Set();
  try {
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

export function unlockAchievement(id: string): boolean {
  const unlocked = getUnlockedAchievements();
  if (unlocked.has(id)) return false;
  unlocked.add(id);
  localStorage.setItem(STORAGE_KEYS.achievements, JSON.stringify([...unlocked]));
  return true;
}
