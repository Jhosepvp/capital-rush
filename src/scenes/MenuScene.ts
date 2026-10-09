import Phaser from 'phaser';
import { getBestScore } from '../data/GameState';
import { createButton } from '../ui/Button';
import { SCORE } from '../data/balance';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#0b0d12');

    const titleSize = Math.round(Math.max(32, Math.min(52, width * 0.11)));
    this.add
      .text(width / 2, height * 0.22, 'CAPITAL RUSH', {
        fontFamily: 'Arial, sans-serif',
        fontSize: `${titleSize}px`,
        color: '#ffd54a',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: width - 32 },
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.22 + 44, 'arena survival económico', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: '#9aa4b2',
      })
      .setOrigin(0.5);

    const stars = '★'.repeat(SCORE.difficultyStars) + '☆'.repeat(5 - SCORE.difficultyStars);
    this.add
      .text(width / 2, height * 0.42, `Dificultad: ${stars}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.42 + 28, `Valor actual: x${SCORE.difficultyMultiplier.toFixed(1)}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        color: '#ffd54a',
      })
      .setOrigin(0.5);

    const best = getBestScore();
    this.add
      .text(width / 2, height * 0.42 + 60, `Mejor puntuación: ${best}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: '#9aa4b2',
      })
      .setOrigin(0.5);

    createButton(this, width / 2, height * 0.68, 220, 60, 'JUGAR', () => {
      this.scene.start('Game');
    });

    this.add
      .text(width / 2, height - 44, 'WASD / Flechas · Joystick en móvil · Ataque automático', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        color: '#5c6472',
        align: 'center',
        wordWrap: { width: width - 32 },
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height - 20, 'Creado por Jhosep Vargas', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '11px',
        color: '#454d57',
        align: 'center',
        wordWrap: { width: width - 32 },
      })
      .setOrigin(0.5);
  }
}
