import { GameState } from '../data/GameState';
import { SCORE, RANKS, FINANCIAL_PROFILE } from '../data/balance';

export interface ScoreBreakdown {
  combatScore: number;
  bossBonus: number;
  survivalBonus: number;
  base: number;
  multiplier: number;
  total: number;
  rank: string;
}

export const ScoreSystem = {
  /**
   * Pure videogame score: combat + survival only. Economic decisions do not
   * grant points here — their payoff lives entirely in "Tu partida
   * financiera" (actual capital gained or lost), not in arbitrary score.
   */
  compute(): ScoreBreakdown {
    const survivalSeconds = GameState.survivalMs / 1000;

    const combatScore = GameState.kills * SCORE.perKill;
    const bossBonus = GameState.bossDefeated ? SCORE.bossDefeatedBonus : 0;
    const survivalBonus = Math.round(
      GameState.roundsCompleted * SCORE.perRoundSurvivedBonus + survivalSeconds * SCORE.perSurvivalSecond
    );

    const base = combatScore + bossBonus + survivalBonus;
    const total = Math.round(base * SCORE.difficultyMultiplier);
    const rank = RANKS.find((r) => total >= r.min)?.label ?? 'D';

    return {
      combatScore,
      bossBonus,
      survivalBonus,
      base: Math.round(base),
      multiplier: SCORE.difficultyMultiplier,
      total,
      rank,
    };
  },
};

export interface FinancialProfile {
  title: string;
  description: string;
  tags: string[];
  shares: { equip: number; invest: number; save: number };
  amounts: { equip: number; invest: number; save: number };
  totalHandled: number;
}

/**
 * Derives the "financial style" from how the player's capital was actually
 * split across equipment / investment / savings during the run — not from
 * counting how many times each menu button was pressed.
 */
export function computeFinancialProfile(): FinancialProfile {
  const amounts = {
    equip: GameState.equipmentSpent,
    invest: GameState.totalInvested,
    save: GameState.totalSaved,
  };
  const totalHandled = amounts.equip + amounts.invest + amounts.save;

  const shares =
    totalHandled > 0
      ? {
          equip: amounts.equip / totalHandled,
          invest: amounts.invest / totalHandled,
          save: amounts.save / totalHandled,
        }
      : { equip: 0, invest: 0, save: 0 };

  const tags: string[] = [];
  if (shares.equip >= FINANCIAL_PROFILE.highShareThreshold) tags.push('ALTO CONSUMO', 'ALTA POTENCIA');
  else if (shares.equip <= FINANCIAL_PROFILE.lowShareThreshold && totalHandled > 0) tags.push('BAJO CONSUMO');
  if (shares.invest >= FINANCIAL_PROFILE.highShareThreshold) tags.push('ALTO RIESGO');
  else if (shares.invest <= FINANCIAL_PROFILE.lowShareThreshold && totalHandled > 0) tags.push('BAJO RIESGO');
  if (shares.save >= FINANCIAL_PROFILE.highShareThreshold) tags.push('ALTA LIQUIDEZ');
  else if (shares.save <= FINANCIAL_PROFILE.lowShareThreshold && totalHandled > 0) tags.push('BAJA LIQUIDEZ');

  if (totalHandled === 0) {
    return {
      title: 'El Equilibrado',
      description: 'No llegaste a mover capital en esta partida.',
      tags: [],
      shares,
      amounts,
      totalHandled,
    };
  }

  const dominant = (['equip', 'invest', 'save'] as const).reduce((a, b) => (shares[b] > shares[a] ? b : a));
  const dominantPct = Math.round(shares[dominant] * 100);

  if (shares[dominant] < FINANCIAL_PROFILE.dominantShareThreshold) {
    return {
      title: 'El Estratega',
      description: 'Distribuiste tu capital de forma relativamente equilibrada entre equipo, inversión y reserva.',
      tags,
      shares,
      amounts,
      totalHandled,
    };
  }

  switch (dominant) {
    case 'equip':
      return {
        title: 'El Arsenal',
        description: `Gastaste ${dominantPct}% de tu capital movido en ventajas de combate.`,
        tags,
        shares,
        amounts,
        totalHandled,
      };
    case 'invest':
      return {
        title: 'El Inversor',
        description: `Destinaste ${dominantPct}% de tu capital movido a inversiones de riesgo.`,
        tags,
        shares,
        amounts,
        totalHandled,
      };
    case 'save':
      return {
        title: 'El Reservista',
        description: `Conservaste ${dominantPct}% de tu capital movido en reservas de seguridad.`,
        tags,
        shares,
        amounts,
        totalHandled,
      };
  }
}
