import Phaser from 'phaser';
import { GameState } from '../data/GameState';
import { EconomySystem } from '../systems/EconomySystem';
import { createButton, ButtonHandle } from '../ui/Button';
import { ECONOMY, EquipmentDef, UI_COLORS } from '../data/balance';

interface EconomySceneData {
  round: number;
  onContinue: () => void;
}

const NARROW_BREAKPOINT = 560;

const EQUIPMENT_ICON: Partial<Record<EquipmentDef['id'], string>> = {
  pistol: 'player_projectile',
  insurance: 'insurance_pickup',
  fireRate: 'buff_pickup',
};

export class EconomyScene extends Phaser.Scene {
  private sceneData!: EconomySceneData;
  private moneyText!: Phaser.GameObjects.Text;
  private resultText!: Phaser.GameObjects.Text;
  private choiceButtons: ButtonHandle[] = [];
  private subPanel?: Phaser.GameObjects.Container;
  private decided = false;

  private panelWidth = 0;
  private stacked = false;
  private choiceBlockBottomY = 0;
  private subPanelY = 0;

  constructor() {
    super('Economy');
  }

  init(data: EconomySceneData) {
    this.sceneData = data;
    this.decided = false;
    this.choiceButtons = [];
    this.subPanel = undefined;
  }

  create() {
    const { width, height } = this.scale;
    this.panelWidth = Math.min(620, width - 24);
    this.stacked = this.panelWidth < NARROW_BREAKPOINT;

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
    this.add
      .rectangle(width / 2, height / 2, this.panelWidth, Math.min(640, height - 24), UI_COLORS.panelBg, 0.96)
      .setStrokeStyle(2, UI_COLORS.panelBorder);

    this.add
      .text(width / 2, height / 2 - 205, `RONDA ${this.sceneData.round} COMPLETADA`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
        color: UI_COLORS.textGold,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 - 172, 'CAPITAL DISPONIBLE', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        color: UI_COLORS.textDim,
      })
      .setOrigin(0.5);

    this.moneyText = this.add
      .text(width / 2, height / 2 - 148, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '28px',
        color: UI_COLORS.textPrimary,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.choiceButtons = this.stacked ? this.layoutChoicesStacked(width, height) : this.layoutChoicesRow(width, height);

    this.choiceBlockBottomY = this.stacked ? height / 2 - 100 + 3 * 66 : height / 2 + 40;
    this.subPanelY = this.choiceBlockBottomY + (this.stacked ? 30 : 0);

    this.resultText = this.add
      .text(width / 2, this.choiceBlockBottomY + (this.stacked ? 170 : 130), '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '15px',
        color: UI_COLORS.textSave,
        align: 'center',
        wordWrap: { width: this.panelWidth - 40 },
      })
      .setOrigin(0.5, 0);

    this.refreshMoney();
  }

  private layoutChoicesRow(width: number, height: number): ButtonHandle[] {
    const equipBtn = createButton(this, width / 2 - 200, height / 2 - 40, 230, 80, 'EQUIPO\nmáx. 4 ítems', () => this.openEquipPanel(), {
      bg: UI_COLORS.cyanDark,
      borderColor: UI_COLORS.gold,
    });
    const investBtn = createButton(
      this,
      width / 2,
      height / 2 - 40,
      230,
      80,
      'INVERTIR\nRiesgo medio',
      () => this.openInvestPanel(),
      { bg: UI_COLORS.invest }
    );
    const saveBtn = createButton(
      this,
      width / 2 + 200,
      height / 2 - 40,
      230,
      80,
      `RESERVA\n+${Math.round(ECONOMY.savingsYield * 100)}% seguro`,
      () => this.openSavePanel(),
      { bg: UI_COLORS.save }
    );
    return [equipBtn, investBtn, saveBtn];
  }

  private layoutChoicesStacked(width: number, height: number): ButtonHandle[] {
    const btnWidth = Math.min(320, this.panelWidth - 40);
    const startY = height / 2 - 100;

    const equipBtn = createButton(this, width / 2, startY, btnWidth, 56, 'EQUIPO — máx. 4 ítems', () => this.openEquipPanel(), {
      bg: UI_COLORS.cyanDark,
      borderColor: UI_COLORS.gold,
      fontSize: '15px',
    });
    const investBtn = createButton(
      this,
      width / 2,
      startY + 66,
      btnWidth,
      56,
      'INVERTIR — riesgo medio',
      () => this.openInvestPanel(),
      { bg: UI_COLORS.invest, fontSize: '15px' }
    );
    const saveBtn = createButton(
      this,
      width / 2,
      startY + 132,
      btnWidth,
      56,
      `RESERVA — +${Math.round(ECONOMY.savingsYield * 100)}% seguro`,
      () => this.openSavePanel(),
      { bg: UI_COLORS.save, fontSize: '15px' }
    );
    return [equipBtn, investBtn, saveBtn];
  }

  private refreshMoney() {
    this.moneyText.setText(`$${Math.round(GameState.money)}`);
  }

  private disableChoices() {
    this.choiceButtons.forEach((b) => b.setEnabled(false));
  }

  private clearSubPanel() {
    this.subPanel?.destroy();
    this.subPanel = undefined;
  }

  private showContinue() {
    this.decided = true;
    GameState.snapshotCapital(`post-decisión ronda ${this.sceneData.round}`);
    const { width } = this.scale;
    const continueY = this.resultText.y + this.resultText.height + 30;
    createButton(this, width / 2, continueY, 220, 54, 'CONTINUAR', () => {
      this.sceneData.onContinue();
    });
  }

  // --------------------------------------------------------------- save --

  private openSavePanel() {
    if (this.decided) return;
    this.disableChoices();
    this.clearSubPanel();

    const { width } = this.scale;
    const container = this.add.container(width / 2, this.subPanelY);

    const riskRow = this.add
      .text(0, -40, `RIESGO\nBAJO`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
        color: UI_COLORS.textSave,
        align: 'center',
      })
      .setOrigin(0.5);
    const yieldRow = this.add
      .text(0, 0, `RENDIMIENTO\n+${Math.round(ECONOMY.savingsYield * 100)}%`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
        color: UI_COLORS.textSave,
        align: 'center',
      })
      .setOrigin(0.5);
    container.add([riskRow, yieldRow]);

    const btn = createButton(this, 0, 55, 200, 50, 'RESERVAR', () => this.confirmSave(), { bg: UI_COLORS.save });
    container.add(btn.container);

    this.subPanel = container;
  }

  private confirmSave() {
    if (this.decided) return;
    this.clearSubPanel();

    const result = EconomySystem.save(this.sceneData.round);
    this.refreshMoney();

    this.resultText.setColor(UI_COLORS.textSave);
    this.resultText.setText(
      `Reservaste tu capital.\nRendimiento seguro: +$${result.yieldAmount}\nNuevo saldo: $${Math.round(result.after)}`
    );
    this.showContinue();
  }

  // ------------------------------------------------------------ invest --

  private openInvestPanel() {
    if (this.decided) return;
    this.disableChoices();
    this.clearSubPanel();

    const { width } = this.scale;
    const container = this.add.container(width / 2, this.subPanelY);

    const riskLabel = this.add
      .text(0, -70, 'RIESGO\nMEDIO', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
        color: UI_COLORS.textInvest,
        align: 'center',
      })
      .setOrigin(0.5);
    container.add(riskLabel);

    const label = this.add
      .text(0, -30, `¿Cuánto inviertes? (disponible $${Math.round(GameState.money)})`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: UI_COLORS.textPrimary,
        align: 'center',
        wordWrap: { width: this.panelWidth - 60 },
      })
      .setOrigin(0.5);
    container.add(label);

    if (this.stacked) {
      const btnWidth = Math.min(280, this.panelWidth - 60);
      ECONOMY.investVariancePresets.forEach((pct, i) => {
        const amount = Math.round(GameState.money * pct);
        const btn = createButton(
          this,
          0,
          15 + i * 58,
          btnWidth,
          50,
          `${Math.round(pct * 100)}%  —  $${amount}`,
          () => this.confirmInvest(amount),
          { bg: UI_COLORS.invest, disabled: amount <= 0, onDisabledClick: () => this.showInsufficientFunds(0, 15 + i * 58, container) }
        );
        container.add(btn.container);
      });
    } else {
      ECONOMY.investVariancePresets.forEach((pct, i) => {
        const amount = Math.round(GameState.money * pct);
        const btn = createButton(
          this,
          (i - 1) * 170,
          20,
          150,
          56,
          `${Math.round(pct * 100)}%\n$${amount}`,
          () => this.confirmInvest(amount),
          { bg: UI_COLORS.invest, disabled: amount <= 0, onDisabledClick: () => this.showInsufficientFunds((i - 1) * 170, 20, container) }
        );
        container.add(btn.container);
      });
    }

    this.subPanel = container;
  }

  private confirmInvest(amount: number) {
    if (this.decided) return;
    this.clearSubPanel();

    const result = EconomySystem.invest(this.sceneData.round, amount);
    this.refreshMoney();

    const sign = result.profit >= 0 ? '+' : '';
    const arrow = result.profit >= 0 ? '▲' : '▼';
    this.resultText.setColor(result.profit >= 0 ? UI_COLORS.textSave : UI_COLORS.textDanger);
    this.resultText.setText(
      `Invertiste: $${result.invested}\n\n${arrow} ${Math.round(result.pct * 100)}%\n\nNuevo valor: $${result.resultAmount}\n${result.profit >= 0 ? 'GANANCIA' : 'PÉRDIDA'}: ${sign}$${result.profit}`
    );

    this.showContinue();
  }

  // ------------------------------------------------------------- equip --

  private openEquipPanel() {
    if (this.decided) return;
    this.disableChoices();
    this.clearSubPanel();

    const { width } = this.scale;
    const container = this.add.container(width / 2, this.subPanelY);
    const items = EconomySystem.availableEquipment();

    if (items.length === 0) {
      const label = this.add
        .text(0, 0, 'Ya tienes todo el equipo disponible.', {
          fontFamily: 'Arial, sans-serif',
          fontSize: '14px',
          color: UI_COLORS.textDim,
        })
        .setOrigin(0.5);
      container.add(label);
      this.subPanel = container;
      return;
    }

    const addIcon = (item: EquipmentDef, x: number, y: number) => {
      const iconKey = EQUIPMENT_ICON[item.id];
      if (!iconKey) return;
      const icon = this.add.image(x, y, iconKey).setScale(0.22);
      container.add(icon);
    };

    if (this.stacked) {
      const btnWidth = Math.min(320, this.panelWidth - 40);
      items.forEach((item, i) => {
        const affordable = EconomySystem.canAfford(item);
        const y = i * 60;
        const btn = createButton(
          this,
          0,
          y,
          btnWidth,
          54,
          `${item.name}  $${item.price}\n${item.effect}`,
          () => this.buyEquipment(item),
          {
            bg: UI_COLORS.cyanDark,
            borderColor: UI_COLORS.gold,
            disabled: !affordable,
            fontSize: '12px',
            onDisabledClick: () => this.showInsufficientFunds(0, y, container, item.price),
          }
        );
        container.add(btn.container);
        addIcon(item, -btnWidth / 2 + 22, y);
      });
    } else {
      items.forEach((item, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = (col - 0.5) * 240;
        const y = row * 64 - (items.length > 2 ? 30 : 0);

        const affordable = EconomySystem.canAfford(item);
        const btn = createButton(
          this,
          x,
          y,
          230,
          58,
          `${item.name}  $${item.price}\n${item.effect}`,
          () => this.buyEquipment(item),
          {
            bg: UI_COLORS.cyanDark,
            borderColor: UI_COLORS.gold,
            disabled: !affordable,
            fontSize: '13px',
            onDisabledClick: () => this.showInsufficientFunds(x, y, container, item.price),
          }
        );
        container.add(btn.container);
        addIcon(item, x - 95, y);
      });
    }

    this.subPanel = container;
  }

  private buyEquipment(item: EquipmentDef) {
    if (this.decided) return;
    const ok = EconomySystem.buyEquipment(this.sceneData.round, item.id);
    if (!ok) return;

    this.clearSubPanel();
    this.refreshMoney();

    this.resultText.setColor(UI_COLORS.textSave);
    this.resultText.setText(`Equipaste: ${item.name}\n${item.effect}\nCapital restante: $${Math.round(GameState.money)}`);
    this.showContinue();
  }

  // ------------------------------------------------------------ shared --

  /** Insufficient-funds feedback: a disabled button tap must never be a silent no-op. */
  private showInsufficientFunds(x: number, y: number, container: Phaser.GameObjects.Container, price?: number) {
    const missing = price !== undefined ? Math.max(0, Math.round(price - GameState.money)) : undefined;
    const text = this.add
      .text(x, y - 36, missing ? `Necesitas $${missing} más` : 'FONDOS INSUFICIENTES', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        color: UI_COLORS.textDanger,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    container.add(text);

    this.tweens.add({
      targets: text,
      y: y - 56,
      alpha: 0,
      duration: 700,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy(),
    });
  }
}
