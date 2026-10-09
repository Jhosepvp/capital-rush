import Phaser from 'phaser';

/**
 * Virtual joystick for mobile. Listens on the scene's input plugin so it
 * works alongside keyboard controls without stealing focus from UI buttons
 * placed outside its activation zone (bottom-left of the screen).
 */
export class TouchJoystick {
  private base: Phaser.GameObjects.Arc;
  private thumb: Phaser.GameObjects.Arc;
  private pointerId: number | null = null;
  private vector = { x: 0, y: 0 };
  private readonly radius = 70;
  private readonly origin: { x: number; y: number };

  constructor(private scene: Phaser.Scene, originX: number, originY: number) {
    this.origin = { x: originX, y: originY };

    this.base = scene.add
      .circle(originX, originY, this.radius, 0xffffff, 0.08)
      .setStrokeStyle(2, 0xffffff, 0.25)
      .setScrollFactor(0)
      .setDepth(1000);

    this.thumb = scene.add.circle(originX, originY, 28, 0xffffff, 0.2).setScrollFactor(0).setDepth(1001);

    this.setVisible(this.isTouchDevice());

    scene.input.on('pointerdown', this.onPointerDown, this);
    scene.input.on('pointermove', this.onPointerMove, this);
    scene.input.on('pointerup', this.onPointerUp, this);
    scene.input.on('pointerupoutside', this.onPointerUp, this);
  }

  private isTouchDevice(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  private setVisible(visible: boolean) {
    this.base.setVisible(visible);
    this.thumb.setVisible(visible);
  }

  private inZone(x: number, y: number, width: number, height: number): boolean {
    return x < width * 0.5 && y > height * 0.3;
  }

  private onPointerDown(pointer: Phaser.Input.Pointer) {
    if (this.pointerId !== null) return;
    const cam = this.scene.cameras.main;
    if (!this.inZone(pointer.x, pointer.y, cam.width, cam.height)) return;

    this.pointerId = pointer.id;
    this.base.setPosition(pointer.x, pointer.y);
    this.thumb.setPosition(pointer.x, pointer.y);
    this.setVisible(true);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer) {
    if (this.pointerId !== pointer.id) return;

    const dx = pointer.x - this.base.x;
    const dy = pointer.y - this.base.y;
    const dist = Math.min(this.radius, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);

    this.thumb.setPosition(this.base.x + Math.cos(angle) * dist, this.base.y + Math.sin(angle) * dist);

    const normalized = dist < 8 ? 0 : dist / this.radius;
    this.vector.x = normalized === 0 ? 0 : Math.cos(angle) * normalized;
    this.vector.y = normalized === 0 ? 0 : Math.sin(angle) * normalized;
  }

  private onPointerUp(pointer: Phaser.Input.Pointer) {
    if (this.pointerId !== pointer.id) return;

    this.pointerId = null;
    this.vector.x = 0;
    this.vector.y = 0;
    this.setVisible(this.isTouchDevice());
    this.base.setPosition(this.origin.x, this.origin.y);
    this.thumb.setPosition(this.origin.x, this.origin.y);
  }

  getVector(): { x: number; y: number } {
    return this.vector;
  }

  destroy() {
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('pointerup', this.onPointerUp, this);
    this.scene.input.off('pointerupoutside', this.onPointerUp, this);
    this.base.destroy();
    this.thumb.destroy();
  }
}
