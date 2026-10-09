import { GameState } from '../data/GameState';
import { ECONOMY, INVEST_OUTCOMES, EQUIPMENT, EQUIPMENT_EFFECTS, EquipmentDef } from '../data/balance';

export interface InvestResult {
  invested: number;
  pct: number;
  resultAmount: number;
  profit: number;
}

function pickWeightedOutcome(): number {
  const totalWeight = INVEST_OUTCOMES.reduce((sum, o) => sum + o.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const outcome of INVEST_OUTCOMES) {
    if (roll < outcome.weight) return outcome.pct;
    roll -= outcome.weight;
  }
  return INVEST_OUTCOMES[INVEST_OUTCOMES.length - 1].pct;
}

export const EconomySystem = {
  save(round: number) {
    const before = GameState.money;
    const yieldAmount = Math.round(before * ECONOMY.savingsYield);
    GameState.money += yieldAmount;

    GameState.totalSaved += before;
    GameState.savingsInterest += yieldAmount;
    GameState.savings.push({ round, amountBefore: before, interest: yieldAmount });

    return { before, yieldAmount, after: GameState.money };
  },

  invest(round: number, amount: number): InvestResult {
    const invested = Math.min(Math.max(0, Math.round(amount)), GameState.money);
    const pct = pickWeightedOutcome();
    const resultAmount = Math.round(invested * (1 + pct));
    const profit = resultAmount - invested;

    GameState.money = GameState.money - invested + resultAmount;

    GameState.totalInvested += invested;
    GameState.investmentReturns += resultAmount;
    GameState.investmentProfitLoss += profit;
    GameState.investments.push({ round, invested, returnRate: pct, returnedAmount: resultAmount, profitLoss: profit });

    return { invested, pct, resultAmount, profit };
  },

  availableEquipment(): EquipmentDef[] {
    return EQUIPMENT.filter((item) => !GameState.equipmentBought.has(item.id));
  },

  canAfford(item: EquipmentDef): boolean {
    return GameState.money >= item.price;
  },

  buyEquipment(round: number, id: EquipmentDef['id']): boolean {
    const item = EQUIPMENT.find((e) => e.id === id);
    if (!item) return false;
    if (GameState.equipmentBought.has(id)) return false;
    if (GameState.money < item.price) return false;

    GameState.money -= item.price;
    GameState.equipmentBought.add(id);
    GameState.equipmentSpent += item.price;
    GameState.purchases.push({ round, itemId: item.id, itemName: item.name, price: item.price, effect: item.effect });

    switch (id) {
      case 'pistol':
        GameState.damageMultiplier *= 1 + EQUIPMENT_EFFECTS.pistolDamageBonus;
        break;
      case 'fireRate':
        GameState.fireRateMultiplier *= 1 - EQUIPMENT_EFFECTS.fireRateBonus;
        break;
      case 'armor':
        GameState.damageReduction = Math.min(0.75, GameState.damageReduction + EQUIPMENT_EFFECTS.armorReduction);
        break;
      case 'insurance':
        GameState.insuranceActive = true;
        GameState.insuranceUsed = false;
        break;
    }

    return true;
  },
};
