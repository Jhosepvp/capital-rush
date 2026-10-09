import Phaser from 'phaser';

const LARGE_THRESHOLD = 8;

export class Coin extends Phaser.GameObjects.Image {
  declare body: Phaser.Physics.Arcade.Body;

  value: number;

  constructor(scene: Phaser.Scene, x: number, y: number, value: number) {
    const key = value >= LARGE_THRESHOLD ? 'credit_large' : 'credit_small';
    super(scene, x, y, key);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Hitbox is a small circle around the coin's center, independent of
    // the sprite's glow/sparkle art.
    const radius = 10;
    this.body.setCircle(radius, this.width / 2 - radius, this.height / 2 - radius);
    this.setDepth(4);

    this.value = value;

    this.setScale(0);
    scene.tweens.add({
      targets: this,
      scale: 0.3,
      duration: 180,
      ease: 'Back.easeOut',
    });
  }
}
