import Phaser from 'phaser';
import { CRATE } from '../data/balance';
import { FX } from '../systems/FX';

export class Crate extends Phaser.GameObjects.Rectangle {
  declare body: Phaser.Physics.Arcade.Body;
  private readonly visual: Phaser.GameObjects.Image;
  private breaking = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, CRATE.radius * 2, CRATE.radius * 2, CRATE.color, 1);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Collider is the original simple square — unaffected by swapping in
    // the crate artwork, which reads a bit larger than the hitbox.
    this.body.setSize(CRATE.radius * 2, CRATE.radius * 2);
    this.body.setImmovable(true);
    this.setDepth(3);
    this.setVisible(false);

    this.visual = scene.add.image(x, y, 'cash_crate');
    this.visual.setDisplaySize(CRATE.radius * 2.6, CRATE.radius * 2.6);
    this.visual.setDepth(3);
  }

  break() {
    this.breaking = true;

    FX.spriteBurst(this.scene, 'explosion_small', this.x, this.y, {
      startScale: 0.5,
      endScale: 1,
      duration: 260,
      depth: 7,
    });

    this.visual.setTexture('cash_crate_destroyed');
    this.scene.tweens.add({
      targets: this.visual,
      alpha: 0,
      scale: this.visual.scale * 1.15,
      duration: 380,
      ease: 'Quad.easeOut',
      onComplete: () => this.visual.destroy(),
    });

    this.destroy();
  }

  /** Round-end cleanup (group.clear) bypasses break() — tear the visual down immediately in that case, but leave it alone mid fade-out. */
  destroy(fromScene?: boolean): void {
    if (!this.breaking && this.visual.active) this.visual.destroy();
    super.destroy(fromScene);
  }
}
