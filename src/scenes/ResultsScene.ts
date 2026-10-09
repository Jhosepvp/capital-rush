import Phaser from 'phaser';
import { GameState, getBestScore, setBestScore } from '../data/GameState';
import { ScoreSystem, computeFinancialProfile } from '../systems/ScoreSystem';
import { evaluateAchievements } from '../systems/Achievements';
import { createButton } from '../ui/Button';
import { UI_COLORS } from '../data/balance';

interface ResultsSceneData {
  completed: boolean;
}

const COLOR = {
  title: UI_COLORS.textGold,
  sub: UI_COLORS.textDim,
  sectionHeader: UI_COLORS.textCyan,
  value: UI_COLORS.textPrimary,
  positive: UI_COLORS.textSave,
  negative: UI_COLORS.textDanger,
  dim: UI_COLORS.textDim,
};

export class ResultsScene extends Phaser.Scene {
  constructor() {
    super('Results');
  }

  create(data: ResultsSceneData) {
    GameState.snapshotCapital('final');

    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#0a0e16');

    const score = ScoreSystem.compute();
    const previousBest = getBestScore();
    const isNewBest = score.total > previousBest;
    if (isNewBest) setBestScore(score.total);
    const bestToShow = Math.max(previousBest, score.total);

    const profile = computeFinancialProfile();
    const achievements = evaluateAchievements();

    const content = this.add.container(0, 0);
    const centerX = width / 2;
    const panelWidth = Math.min(560, width - 32);
    let y = 20;

    const addText = (
      str: string,
      fontSize: string,
      color: string,
      opts: { bold?: boolean; align?: 'left' | 'center'; wrap?: boolean; gap?: number } = {}
    ) => {
      const t = this.add
        .text(centerX, y, str, {
          fontFamily: 'Arial, sans-serif',
          fontSize,
          color,
          fontStyle: opts.bold ? 'bold' : 'normal',
          align: opts.align ?? 'center',
          wordWrap: opts.wrap ? { width: panelWidth } : undefined,
        })
        .setOrigin(0.5, 0);
      content.add(t);
      y += t.height + (opts.gap ?? 4);
      return t;
    };

    const addSpacer = (h: number) => {
      y += h;
    };

    const addDivider = () => {
      const line = this.add.rectangle(centerX, y, panelWidth, 2, 0x1b5f72, 1);
      content.add(line);
      y += 16;
    };

    const addSectionHeader = (label: string) => {
      addSpacer(10);
      addText(label, '14px', COLOR.sectionHeader, { bold: true, gap: 10 });
    };

    // ---------------------------------------------------- A) VIDEOJUEGO --

    addText(data.completed ? 'VICTORIA' : 'DERROTA', '30px', data.completed ? COLOR.title : COLOR.negative, {
      bold: true,
      gap: 2,
    });
    addText(
      data.completed ? 'THE COLLECTOR DERROTADO' : `Caíste en la ronda ${GameState.currentRound}`,
      '13px',
      COLOR.sub,
      { gap: 16 }
    );

    addSectionHeader('COMBATE');
    addText(`Enemigos eliminados        +${score.combatScore}`, '15px', COLOR.value, { align: 'left' });
    if (GameState.bossDefeated) {
      addText(`The Collector               +${score.bossBonus}`, '15px', COLOR.value, { align: 'left' });
    }
    addText(`Supervivencia               +${score.survivalBonus}`, '15px', COLOR.value, { align: 'left', gap: 12 });

    addText(`SCORE BASE`, '13px', COLOR.sub, { gap: 2 });
    addText(`${score.base}`, '20px', COLOR.value, { bold: true, gap: 12 });

    addText(`VALOR DE CAPITAL RUSH  x${score.multiplier.toFixed(1)}`, '13px', COLOR.sub, { gap: 14 });

    addText('TOTAL', '13px', COLOR.sub, { gap: 2 });
    addText(`${score.total}`, '34px', COLOR.title, { bold: true, gap: 4 });
    addText(
      `RANGO ${score.rank}${isNewBest ? '   ¡NUEVO RÉCORD!' : ''}`,
      '15px',
      isNewBest ? COLOR.positive : COLOR.sub,
      { gap: 2 }
    );
    addText(`Mejor puntuación: ${bestToShow}`, '12px', COLOR.dim, { gap: 4 });

    // ------------------------------------------------- B) PARTIDA FINANCIERA --

    addDivider();
    addSectionHeader('TU PARTIDA FINANCIERA');

    addText('DINERO GENERADO', '12px', COLOR.sub, { gap: 2 });
    addText(`+$${Math.round(GameState.moneyEarnedTotal)}`, '18px', COLOR.positive, { bold: true, gap: 14 });

    if (GameState.purchases.length > 0) {
      addText('EQUIPO', '12px', COLOR.sub, { gap: 2 });
      addText(`-$${Math.round(GameState.equipmentSpent)}`, '18px', COLOR.negative, { bold: true, gap: 6 });
      for (const p of GameState.purchases) {
        addText(`${p.itemName}  -$${p.price}  (${p.effect})`, '13px', COLOR.value, { gap: 3 });
      }
      addSpacer(10);
    }

    if (GameState.investments.length > 0) {
      addText('INVERSIÓN', '12px', COLOR.sub, { gap: 2 });
      for (const inv of GameState.investments) {
        const profit = inv.profitLoss >= 0;
        const sign = profit ? '+' : '';
        addText(
          `Ronda ${inv.round}: invertiste $${inv.invested} → retorno $${inv.returnedAmount}`,
          '13px',
          COLOR.value,
          { gap: 2 }
        );
        addText(
          `${profit ? 'GANANCIA' : 'PÉRDIDA'} ${sign}$${inv.profitLoss}   RENTABILIDAD ${sign}${Math.round(inv.returnRate * 100)}%`,
          '13px',
          profit ? COLOR.positive : COLOR.negative,
          { bold: true, gap: 6 }
        );
      }
      addSpacer(4);
    }

    if (GameState.savings.length > 0) {
      addText('AHORRO', '12px', COLOR.sub, { gap: 2 });
      for (const s of GameState.savings) {
        addText(
          `Ronda ${s.round}: reservaste $${s.amountBefore} → interés +$${s.interest}`,
          '13px',
          COLOR.positive,
          { gap: 3 }
        );
      }
      addSpacer(10);
    }

    addDivider();
    addText('CAPITAL FINAL', '12px', COLOR.sub, { gap: 2 });
    addText(`$${Math.round(GameState.money)}`, '26px', COLOR.title, { bold: true, gap: 4 });

    // --------------------------------------------------- ESTILO FINANCIERO --

    addDivider();
    addSectionHeader('ESTILO FINANCIERO');
    addText(profile.title, '22px', COLOR.title, { bold: true, gap: 6 });
    addText(profile.description, '13px', COLOR.value, { wrap: true, gap: 10 });

    if (profile.totalHandled > 0) {
      addText(
        `Equipo: $${Math.round(profile.amounts.equip)}   Inversión: $${Math.round(profile.amounts.invest)}   Reserva: $${Math.round(profile.amounts.save)}`,
        '12px',
        COLOR.sub,
        { gap: 6, wrap: true }
      );
    }
    if (profile.tags.length > 0) {
      addText(profile.tags.join('   '), '12px', COLOR.positive, { bold: true, gap: 4 });
    }

    // --------------------------------------------------------------- LOGROS --

    addDivider();
    addSectionHeader('LOGROS');
    for (const a of achievements) {
      addText(
        `${a.unlocked ? '[X]' : '[ ]'} ${a.title}${a.justUnlocked ? '   ¡nuevo!' : ''}`,
        '14px',
        a.unlocked ? COLOR.positive : COLOR.dim,
        { bold: a.unlocked, gap: 2 }
      );
      addText(a.description, '12px', COLOR.dim, { gap: 10 });
    }

    // ----------------------------------------------------------------- CTA --

    addSpacer(10);
    const buttonHandle = createButton(this, centerX, y + 28, 260, 54, 'VOLVER A JUGAR', () => {
      this.scene.start('Game');
    });
    content.add(buttonHandle.container);
    y += 28 + 54 + 24;

    // ------------------------------------------------------------- scroll --

    const contentHeight = y;
    const maxScroll = Math.max(0, contentHeight - height + 16);

    if (maxScroll > 0) {
      let scrollY = 0;

      // --- Visible scrollbar: track + draggable thumb + step arrows, so
      // desktop players (no swipe gesture) can see there's more content and
      // how to reach it, not just discover wheel-scroll by accident.
      const trackX = width - 16;
      const arrowGap = 22;
      const trackTop = 58 + arrowGap;
      const trackBottom = height - 10 - arrowGap;
      const trackHeight = Math.max(20, trackBottom - trackTop);
      const thumbHeight = Phaser.Math.Clamp((height / contentHeight) * trackHeight, 24, trackHeight);

      this.add.rectangle(trackX, (trackTop + trackBottom) / 2, 6, trackHeight, 0x1c1f29, 1).setStrokeStyle(1, 0x1b5f72);

      const thumb = this.add
        .rectangle(trackX, trackTop + thumbHeight / 2, 12, thumbHeight, 0x4a5262, 1)
        .setStrokeStyle(1, 0x6fa8ff)
        .setInteractive({ useHandCursor: true });
      this.input.setDraggable(thumb);

      const upBtn = this.add
        .text(trackX, 58, '▲', { fontFamily: 'Arial, sans-serif', fontSize: '14px', color: COLOR.sub })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      const downBtn = this.add
        .text(trackX, height - 10, '▼', { fontFamily: 'Arial, sans-serif', fontSize: '14px', color: COLOR.sub })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      const applyScroll = (v: number) => {
        scrollY = Phaser.Math.Clamp(v, 0, maxScroll);
        content.y = -scrollY;
        const ratio = maxScroll > 0 ? scrollY / maxScroll : 0;
        thumb.y = trackTop + thumbHeight / 2 + ratio * (trackHeight - thumbHeight);
      };

      upBtn.on('pointerdown', () => applyScroll(scrollY - 160));
      downBtn.on('pointerdown', () => applyScroll(scrollY + 160));

      thumb.on('drag', (_pointer: Phaser.Input.Pointer, _dragX: number, dragY: number) => {
        const usableRange = trackHeight - thumbHeight;
        const ratio = usableRange > 0 ? (dragY - trackTop - thumbHeight / 2) / usableRange : 0;
        applyScroll(ratio * maxScroll);
      });

      this.input.on('wheel', (_p: unknown, _go: unknown, _dx: number, dy: number) => applyScroll(scrollY + dy * 0.6));

      // Swipe/drag directly on the content too (mobile-friendly), ignoring
      // drags that start on the thumb itself (it handles its own drag).
      let dragging = false;
      let dragStartY = 0;
      let scrollStartY = 0;
      this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (p.x >= trackX - 16) return;
        dragging = true;
        dragStartY = p.y;
        scrollStartY = scrollY;
      });
      this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
        if (!dragging) return;
        applyScroll(scrollStartY - (p.y - dragStartY));
      });
      this.input.on('pointerup', () => (dragging = false));
      this.input.on('pointerupoutside', () => (dragging = false));
    }
  }
}
