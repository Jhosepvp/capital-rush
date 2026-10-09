import Phaser from 'phaser';

export interface ButtonHandle {
  container: Phaser.GameObjects.Container;
  setEnabled: (enabled: boolean) => void;
  destroy: () => void;
}

export interface ButtonOptions {
  bg?: number;
  bgHover?: number;
  bgDisabled?: number;
  borderColor?: number;
  textColor?: string;
  fontSize?: string;
  disabled?: boolean;
  /** Called instead of onClick when the button is tapped while disabled — use for "insufficient funds" style feedback instead of a silent no-op. */
  onDisabledClick?: () => void;
}

export function createButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  onClick: () => void,
  options: ButtonOptions = {}
): ButtonHandle {
  const bg = options.bg ?? 0x1f6feb;
  const bgHover = options.bgHover ?? 0x3b82f6;
  const bgDisabled = options.bgDisabled ?? 0x3a3f4b;
  const textColor = options.textColor ?? '#ffffff';
  const fontSize = options.fontSize ?? '18px';

  const rect = scene.add.rectangle(0, 0, width, height, bg, 1).setStrokeStyle(2, options.borderColor ?? 0xffffff, 0.3);
  const text = scene.add
    .text(0, 0, label, {
      fontFamily: 'Arial, sans-serif',
      fontSize,
      color: textColor,
      align: 'center',
    })
    .setOrigin(0.5);

  const container = scene.add.container(x, y, [rect, text]);
  container.setSize(width, height);
  rect.setInteractive({ useHandCursor: true });

  let enabled = true;

  rect.on('pointerover', () => {
    if (enabled) rect.setFillStyle(bgHover, 1);
  });
  rect.on('pointerout', () => {
    rect.setFillStyle(enabled ? bg : bgDisabled, 1);
  });
  rect.on('pointerdown', () => {
    if (enabled) onClick();
    else options.onDisabledClick?.();
  });

  function setEnabled(value: boolean) {
    enabled = value;
    rect.setFillStyle(value ? bg : bgDisabled, 1);
    text.setAlpha(value ? 1 : 0.5);
  }

  setEnabled(!options.disabled);

  function destroy() {
    container.destroy();
  }

  return { container, setEnabled, destroy };
}
