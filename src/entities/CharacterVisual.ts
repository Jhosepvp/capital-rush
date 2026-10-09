import Phaser from 'phaser';

export type Direction = 'down' | 'up' | 'left' | 'right';
type Pose = 'idle' | 'walk_1' | 'walk_2' | 'attack';

const WALK_FRAME_MS = 160;
const MIN_ATTACK_POSE_MS = 220;
const MOVE_EPS = 4;

export interface SpriteMeta {
  canvasWidth: number;
  canvasHeight: number;
  anchorX: number;
  anchorY: number;
  targetDisplayHeight: number;
}

/**
 * Movement/attack → facing direction, per the spec:
 * dominant axis wins (|vx|>|vy| => left/right, else up/down), and the
 * last facing is kept when there's no meaningful vector (e.g. stopped).
 */
export function dominantDirection(vx: number, vy: number, fallback: Direction): Direction {
  if (Math.abs(vx) < MOVE_EPS && Math.abs(vy) < MOVE_EPS) return fallback;
  if (Math.abs(vx) > Math.abs(vy)) return vx > 0 ? 'right' : 'left';
  return vy > 0 ? 'down' : 'up';
}

/**
 * Companion sprite that sits on top of an (invisible, physics-only) Arc
 * entity. Owns facing/pose state and swaps textures/animations — the
 * underlying Arc + its physics body are untouched, so collision and combat
 * balance are unaffected by this purely-visual layer.
 */
export class CharacterVisual {
  readonly sprite: Phaser.GameObjects.Sprite;
  private facing: Direction = 'down';
  private currentKey: string | null = null;
  private walkToggle = false;
  private lastWalkToggleAt = 0;
  private attackPoseUntil = 0;
  private attackDirection: Direction | null = null;

  constructor(
    scene: Phaser.Scene,
    private character: string,
    x: number,
    y: number,
    meta: SpriteMeta,
    depth: number
  ) {
    this.sprite = scene.add.sprite(x, y, `${character}_down_idle`);
    this.sprite.setOrigin(meta.anchorX / meta.canvasWidth, meta.anchorY / meta.canvasHeight);
    this.sprite.setScale(meta.targetDisplayHeight / meta.canvasHeight);
    this.sprite.setDepth(depth);
  }

  /** Call when an attack happens; dir is the vector to aim the pose at (not necessarily movement). */
  triggerAttack(dirX: number, dirY: number, time: number, holdMs = MIN_ATTACK_POSE_MS) {
    this.attackDirection = dominantDirection(dirX, dirY, this.facing);
    this.attackPoseUntil = Math.max(this.attackPoseUntil, time + holdMs);
  }

  update(x: number, y: number, vx: number, vy: number, time: number) {
    this.sprite.setPosition(x, y);

    const attacking = time < this.attackPoseUntil;
    if (!attacking) {
      this.facing = dominantDirection(vx, vy, this.facing);
    }
    const direction = attacking && this.attackDirection ? this.attackDirection : this.facing;
    const moving = Math.hypot(vx, vy) > 20;

    let pose: Pose;
    if (attacking) {
      pose = 'attack';
    } else if (moving) {
      if (time - this.lastWalkToggleAt > WALK_FRAME_MS) {
        this.walkToggle = !this.walkToggle;
        this.lastWalkToggleAt = time;
      }
      pose = this.walkToggle ? 'walk_2' : 'walk_1';
    } else {
      pose = 'idle';
    }

    const key = `${this.character}_${direction}_${pose}`;
    if (key !== this.currentKey) {
      this.currentKey = key;
      this.sprite.setTexture(key);
    }
  }

  setVisible(visible: boolean) {
    this.sprite.setVisible(visible);
  }

  destroy() {
    this.sprite.destroy();
  }
}
