import { GameState, unlockAchievement, getUnlockedAchievements } from '../data/GameState';

export interface AchievementDef {
  id: string;
  icon: string;
  title: string;
  description: string;
  check: () => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'emergencyFund',
    icon: '[FUND]',
    title: 'Fondo de emergencia',
    description: 'Termina con al menos $100.',
    check: () => GameState.money >= 100,
  },
  {
    id: 'coldBlood',
    icon: '[INV]',
    title: 'Sangre fría',
    description: 'Obtén una inversión rentable.',
    check: () => GameState.investments.some((i) => i.profitLoss > 0),
  },
  {
    id: 'prepared',
    icon: '[BOSS]',
    title: 'Preparado',
    description: 'Derrota al jefe.',
    check: () => GameState.bossDefeated,
  },
];

export interface AchievementResult extends AchievementDef {
  unlocked: boolean;
  justUnlocked: boolean;
}

export function evaluateAchievements(): AchievementResult[] {
  const alreadyUnlocked = getUnlockedAchievements();

  return ACHIEVEMENTS.map((def) => {
    const wasUnlocked = alreadyUnlocked.has(def.id);
    const earnedNow = def.check();
    let justUnlocked = false;

    if (earnedNow && !wasUnlocked) {
      justUnlocked = unlockAchievement(def.id);
    }

    return { ...def, unlocked: wasUnlocked || earnedNow, justUnlocked };
  });
}
