import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Enemy, EnemyContext } from '../entities/Enemy';
import { BossEnemy } from '../entities/BossEnemy';
import { Projectile } from '../entities/Projectile';
import { EnemyProjectile } from '../entities/EnemyProjectile';
import { Coin } from '../entities/Coin';
import { Crate } from '../entities/Crate';
import { EnemySpawner } from '../systems/EnemySpawner';
import { CombatSystem } from '../systems/CombatSystem';
import { PlayerBehaviorTracker } from '../systems/PlayerBehaviorTracker';
import { FX } from '../systems/FX';
import { TouchJoystick } from '../ui/TouchJoystick';
import { GameState } from '../data/GameState';
import { ARENA, ROUND, CRATE, COIN_MAGNET, EQUIPMENT_EFFECTS, BOSS, UI_COLORS } from '../data/balance';

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private enemies!: Phaser.GameObjects.Group;
  private projectiles!: Phaser.GameObjects.Group;
  private enemyProjectiles!: Phaser.GameObjects.Group;
  private coins!: Phaser.GameObjects.Group;
  private crates!: Phaser.GameObjects.Group;

  private combatSystem!: CombatSystem;
  private enemySpawner!: EnemySpawner;
  private behaviorTracker!: PlayerBehaviorTracker;
  private joystick!: TouchJoystick;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };

  private roundActive = false;
  private isBossRound = false;
  private roundSafetyRemaining = 0;
  private roundElapsedMs = 0;
  private spawnTimer?: Phaser.Time.TimerEvent;
  private boss?: BossEnemy;

  private healthBarFill!: Phaser.GameObjects.Rectangle;
  private healthValueText!: Phaser.GameObjects.Text;
  private moneyText!: Phaser.GameObjects.Text;
  private roundText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private weaponText!: Phaser.GameObjects.Text;

  private bossNameText!: Phaser.GameObjects.Text;
  private bossPhaseText!: Phaser.GameObjects.Text;
  private bossBarBg!: Phaser.GameObjects.Rectangle;
  private bossBarFill!: Phaser.GameObjects.Rectangle;
  private bossHudGroup: Phaser.GameObjects.GameObject[] = [];

  private healthBarWidth = 180;
  private bossBarWidth = 420;

  constructor() {
    super('Game');
  }

  create() {
    GameState.reset();
    GameState.snapshotCapital('inicio');

    this.physics.world.setBounds(0, 0, ARENA.width, ARENA.height);

    // Background image is square and taller than the arena world; display
    // it oversized and centered so the camera (bounded to the arena) only
    // ever shows the middle slice — no stretching, aspect ratio intact.
    this.add
      .image(ARENA.width / 2, ARENA.height / 2, 'arena_bg')
      .setDisplaySize(ARENA.width, ARENA.width)
      .setDepth(-10);

    this.placeDecorativeProps();

    this.player = new Player(this, ARENA.width / 2, ARENA.height / 2);

    this.cameras.main.setBounds(0, 0, ARENA.width, ARENA.height);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setBackgroundColor('#0b0d12');

    this.enemies = this.add.group();
    this.projectiles = this.add.group();
    this.enemyProjectiles = this.add.group();
    this.coins = this.add.group();
    this.crates = this.add.group();

    this.combatSystem = new CombatSystem(this, this.player, this.enemies, this.projectiles);
    this.enemySpawner = new EnemySpawner(this, ARENA.width, ARENA.height);
    this.behaviorTracker = new PlayerBehaviorTracker();

    const keyboard = this.input.keyboard!;
    this.cursors = keyboard.createCursorKeys();
    this.wasd = keyboard.addKeys('W,A,S,D') as typeof this.wasd;

    this.joystick = new TouchJoystick(this, 140, this.scale.height - 140);

    this.setupCollisions();
    this.createHud();

    this.startRound(1);
  }

  // ---------------------------------------------------------------- HUD --

  private createHud() {
    const { width } = this.scale;
    this.bossBarWidth = Math.max(180, Math.min(420, width - 160));

    // --- top-left panel: health / money / weapon -------------------------
    // Shrinks on narrow screens so it never overlaps the top-right panel
    // (fixed width) — both panels anchor to their own screen edge, so on a
    // 320-360px-wide phone a fixed 220px-wide left panel would run into it.
    const rightPanelW = 130;
    const panelGap = 16;
    const maxLeftPanelW = width - 20 - rightPanelW - panelGap;
    this.healthBarWidth = Phaser.Math.Clamp(maxLeftPanelW - 40, 90, 180);
    const leftPanelW = this.healthBarWidth + 40;
    this.add
      .rectangle(10, 10, leftPanelW, 98, UI_COLORS.panelBg, 0.82)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(899)
      .setStrokeStyle(2, UI_COLORS.panelBorder);

    this.add
      .text(22, 18, 'VIDA', { fontFamily: 'Arial, sans-serif', fontSize: '11px', color: UI_COLORS.textDim })
      .setScrollFactor(0)
      .setDepth(900);

    this.healthValueText = this.add
      .text(leftPanelW - 2, 18, '', { fontFamily: 'Arial, sans-serif', fontSize: '11px', color: UI_COLORS.textPrimary })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(900);

    this.add
      .rectangle(22, 34, this.healthBarWidth, 16, UI_COLORS.cyanDark, 1)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(900)
      .setStrokeStyle(1, UI_COLORS.panelBorder);

    this.healthBarFill = this.add
      .rectangle(24, 36, this.healthBarWidth - 4, 12, UI_COLORS.danger, 1)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(901);

    this.add.image(26, 66, 'credit_small').setScale(0.22).setScrollFactor(0).setDepth(900);
    this.moneyText = this.add
      .text(42, 58, '', { fontFamily: 'Arial, sans-serif', fontSize: '17px', color: UI_COLORS.textGold, fontStyle: 'bold' })
      .setScrollFactor(0)
      .setDepth(900);

    this.weaponText = this.add
      .text(22, 82, '', { fontFamily: 'Arial, sans-serif', fontSize: '12px', color: UI_COLORS.textCyan })
      .setScrollFactor(0)
      .setDepth(900);

    // --- top-right panel: round / time ------------------------------------
    this.add
      .rectangle(width - 10, 10, rightPanelW, 56, UI_COLORS.panelBg, 0.82)
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(899)
      .setStrokeStyle(2, UI_COLORS.panelBorder);

    this.roundText = this.add
      .text(width - 20, 18, '', { fontFamily: 'Arial, sans-serif', fontSize: '15px', color: UI_COLORS.textPrimary, fontStyle: 'bold' })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(900);

    this.timeText = this.add
      .text(width - 20, 40, '', { fontFamily: 'Arial, sans-serif', fontSize: '13px', color: UI_COLORS.textDim })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(900);

    // --- boss panel: sits in its own row below the top-left column so the
    // two never overlap, even on narrow portrait screens. ------------------
    const bossPanelBg = this.add
      .rectangle(width / 2, 86, this.bossBarWidth + 24, 64, UI_COLORS.panelBg, 0.85)
      .setScrollFactor(0)
      .setDepth(898)
      .setStrokeStyle(2, UI_COLORS.danger)
      .setVisible(false);

    this.bossNameText = this.add
      .text(width / 2, 64, BOSS.name, { fontFamily: 'Arial, sans-serif', fontSize: '16px', color: UI_COLORS.textDanger, fontStyle: 'bold' })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(900)
      .setVisible(false);

    this.bossBarBg = this.add
      .rectangle(width / 2, 92, this.bossBarWidth, 14, UI_COLORS.cyanDark, 1)
      .setScrollFactor(0)
      .setDepth(900)
      .setStrokeStyle(1, UI_COLORS.panelBorder)
      .setVisible(false);

    this.bossBarFill = this.add
      .rectangle(width / 2 - this.bossBarWidth / 2 + 2, 92, this.bossBarWidth - 4, 10, UI_COLORS.danger, 1)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(901)
      .setVisible(false);

    this.bossPhaseText = this.add
      .text(width / 2, 108, 'FASE 1', { fontFamily: 'Arial, sans-serif', fontSize: '11px', color: UI_COLORS.textDim })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(900)
      .setVisible(false);

    this.bossHudGroup = [bossPanelBg, this.bossNameText, this.bossBarBg, this.bossBarFill, this.bossPhaseText];

    this.refreshHud();
  }

  private weaponLabel(): string {
    const hasPistol = GameState.equipmentBought.has('pistol');
    const hasFireRate = GameState.equipmentBought.has('fireRate');
    const name = hasPistol ? 'Pistola MK-II' : 'Pistola';
    return hasFireRate ? `${name} +CAD` : name;
  }

  private formatTime(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const mm = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, '0');
    const ss = (totalSeconds % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  }

  private refreshHud() {
    const healthPct = Phaser.Math.Clamp(this.player.health / this.player.maxHealth, 0, 1);
    this.healthBarFill.width = (this.healthBarWidth - 4) * healthPct;
    this.healthValueText.setText(`${Math.ceil(this.player.health)}/${Math.round(this.player.maxHealth)}`);
    this.moneyText.setText(`$${Math.round(GameState.money)}`);
    this.weaponText.setText(this.weaponLabel());
    this.timeText.setText(this.formatTime(this.roundElapsedMs));
    if (!this.isBossRound) {
      this.roundText.setText(`RONDA ${GameState.currentRound}/${ROUND.count}`);
    }

    if (this.isBossRound && this.boss && this.boss.active) {
      const pct = Phaser.Math.Clamp(this.boss.health / this.boss.maxHealth, 0, 1);
      this.bossBarFill.width = (this.bossBarWidth - 4) * pct;
      this.bossPhaseText.setText(this.boss.phase === 2 ? 'FASE 2' : 'FASE 1');
      this.bossPhaseText.setColor(this.boss.phase === 2 ? UI_COLORS.textDanger : UI_COLORS.textDim);
    }
  }

  private showBossHud(visible: boolean) {
    for (const obj of this.bossHudGroup) (obj as Phaser.GameObjects.Text | Phaser.GameObjects.Rectangle).setVisible(visible);
    this.roundText.setVisible(!visible);
    this.timeText.setVisible(!visible);
  }

  // --------------------------------------------------------- collisions --

  private setupCollisions() {
    this.physics.add.overlap(this.projectiles, this.enemies, (projectileObj, enemyObj) => {
      this.onPlayerProjectileHitsEnemy(projectileObj as Projectile, enemyObj as Enemy);
    });

    this.physics.add.overlap(this.projectiles, this.crates, (projectileObj, crateObj) => {
      (projectileObj as Projectile).destroy();
      const crate = crateObj as Crate;
      const x = crate.x;
      const y = crate.y;
      crate.break();
      this.rollCrateReward(x, y);
    });

    this.physics.add.overlap(this.enemyProjectiles, this.player, (projObj) => {
      const projectile = projObj as EnemyProjectile;
      const hitKey = projectile.textureKey === 'lancer_projectile' ? 'hit_magenta' : 'hit_red';
      projectile.destroy();

      const mitigated = this.player.takeDamage(projectile.damage, this.time.now);
      if (mitigated > 0) {
        FX.spriteBurst(this, hitKey, this.player.x, this.player.y, { startScale: 0.35, endScale: 0.7, duration: 200, depth: 11 });
        this.behaviorTracker.recordProjectileDamage(mitigated);
        this.checkInsurance();
      }
      this.refreshHud();

      if (this.player.isDead) this.endGame(false);
    });

    this.physics.add.overlap(this.player, this.coins, (_playerObj, coinObj) => {
      const coin = coinObj as Coin;
      GameState.money += coin.value;
      GameState.moneyEarnedTotal += coin.value;
      FX.spriteBurst(this, 'credit_pickup_fx', coin.x, coin.y, { startScale: 0.4, endScale: 0.75, duration: 260, depth: 7 });
      FX.floatingText(this, coin.x, coin.y - 10, `+$${coin.value}`, '#ffd54a', '15px');
      coin.destroy();
      this.refreshHud();
    });
  }

  private onPlayerProjectileHitsEnemy(projectile: Projectile, enemy: Enemy) {
    projectile.destroy();
    const died = enemy.takeDamage(projectile.damage);
    FX.spriteBurst(this, 'hit_cyan', enemy.x, enemy.y, { startScale: 0.3, endScale: 0.65, duration: 180, depth: 7 });

    if (died) {
      FX.spriteBurst(this, enemy.kind === 'boss' ? 'explosion_small' : 'enemy_death', enemy.x, enemy.y, {
        startScale: 0.4,
        endScale: enemy.kind === 'boss' ? 1.2 : 0.9,
        duration: 320,
        depth: 7,
      });

      if (enemy.kind === 'boss') {
        this.onBossDefeated();
      } else if (enemy.isSummonedMinion) {
        // Boss reinforcements grant no score and no money: they exist to
        // raise pressure in the fight, not to be farmed for resources.
        this.boss?.notifyMinionDefeated(this.time.now);
      } else {
        GameState.kills += 1;
        this.spawnCoin(enemy.x, enemy.y, enemy.coinValue);
      }
      enemy.destroy();
    }
  }

  private onBossDefeated() {
    GameState.bossDefeated = true;
    GameState.money += BOSS.coinReward;
    GameState.moneyEarnedTotal += BOSS.coinReward;
    FX.floatingText(this, this.player.x, this.player.y - 40, `+$${BOSS.coinReward}`, '#ffd54a', '20px');
    this.roundActive = false;

    this.time.delayedCall(600, () => {
      GameState.roundsCompleted += 1;
      this.endGame(true);
    });
  }

  private rollCrateReward(x: number, y: number) {
    const roll = Math.random();
    if (roll < CRATE.coinChance) {
      this.spawnCoin(x, y, Phaser.Math.Between(CRATE.coinMin, CRATE.coinMax));
    } else if (roll < CRATE.coinChance + CRATE.healChance) {
      this.player.heal(CRATE.healAmount);
      FX.spriteBurst(this, 'health_pickup_fx', x, y, { startScale: 0.4, endScale: 0.8, duration: 320, depth: 7 });
      FX.floatingText(this, x, y - 10, `+${CRATE.healAmount} HP`, '#9ee6a1', '15px');
      this.refreshHud();
    } else {
      FX.spriteBurst(this, 'buff_pickup', x, y, { startScale: 0.4, endScale: 0.8, duration: 320, depth: 7 });
      GameState.tempDamageBuffUntil = this.time.now + CRATE.buffDurationMs;
      FX.floatingText(this, x, y - 10, 'DAÑO +30%', '#ff8a8a', '15px');
    }
  }

  private checkInsurance() {
    if (!GameState.insuranceActive || GameState.insuranceUsed) return;
    const ratio = this.player.health / this.player.maxHealth;
    if (ratio > EQUIPMENT_EFFECTS.insuranceThreshold) return;

    GameState.insuranceUsed = true;
    this.player.heal(EQUIPMENT_EFFECTS.insuranceHeal);
    FX.floatingText(this, this.player.x, this.player.y - 40, `SEGURO +${EQUIPMENT_EFFECTS.insuranceHeal}`, '#2ecc71', '16px');
  }

  /**
   * Purely decorative scenery — no collider, no gameplay interaction —
   * placed once near the arena edges so the floor doesn't read as an empty
   * void. Kept deliberately sparse and clear of the central play area so
   * nothing blocks movement or spawn paths.
   */
  private placeDecorativeProps() {
    const props: { key: string; x: number; y: number; scale: number }[] = [
      { key: 'cargo_container', x: 150, y: 1100, scale: 0.95 },
      { key: 'terminal_cyan', x: 90, y: 110, scale: 0.75 },
      { key: 'pylon_cyan', x: 1500, y: 100, scale: 0.9 },
      { key: 'pylon_red', x: 1500, y: 1110, scale: 0.9 },
      { key: 'barrier_cyan', x: 800, y: 55, scale: 1.1 },
      { key: 'barrier_magenta', x: 800, y: 1148, scale: 1.05 },
      { key: 'energy_generator', x: 1520, y: 600, scale: 0.9 },
    ];

    // Each kept at its own native aspect ratio (scaled uniformly), never
    // stretched to a forced box size.
    for (const prop of props) {
      this.add.image(prop.x, prop.y, prop.key).setScale(prop.scale).setDepth(2);
    }
  }

  private spawnCoin(x: number, y: number, value: number) {
    const coin = new Coin(this, x, y, value);
    this.coins.add(coin);
  }

  private spawnCrates(count: number) {
    for (let i = 0; i < count; i++) {
      let x = 0;
      let y = 0;
      let attempts = 0;
      do {
        x = Phaser.Math.Between(80, ARENA.width - 80);
        y = Phaser.Math.Between(80, ARENA.height - 80);
        attempts += 1;
      } while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 160 && attempts < 10);

      const crate = new Crate(this, x, y);
      this.crates.add(crate);
    }
  }

  // ----------------------------------------------------------- rounds --

  private startRound(round: number) {
    GameState.currentRound = round;

    if (this.isBossRoundNumber(round)) {
      this.startBossRound();
      return;
    }

    this.isBossRound = false;
    this.roundActive = true;
    this.roundSafetyRemaining = ROUND.safetyDurationMs;
    this.roundElapsedMs = 0;

    this.behaviorTracker.reset();
    this.enemySpawner.prepareRound(round);
    this.spawnCrates(ROUND.crateCount);

    this.spawnTimer = this.time.addEvent({
      delay: ROUND.spawnIntervalMs,
      loop: true,
      callback: () => this.trySpawnEnemy(round),
    });

    this.trySpawnEnemy(round);
    this.showBossHud(false);
    this.refreshHud();
  }

  private isBossRoundNumber(round: number): boolean {
    return round >= ROUND.count;
  }

  private trySpawnEnemy(round: number) {
    if (!this.roundActive) return;
    const livingEnemies = this.enemies.getChildren() as Enemy[];
    const enemy = this.enemySpawner.spawnNext(
      round,
      this.player.x,
      this.player.y,
      livingEnemies,
      GameState.adaptation,
      1,
      1
    );
    if (enemy) this.enemies.add(enemy);
  }

  private endRound() {
    this.roundActive = false;
    this.spawnTimer?.remove();

    for (const obj of this.coins.getChildren()) {
      const coin = obj as Coin;
      GameState.money += coin.value;
      GameState.moneyEarnedTotal += coin.value;
    }
    this.coins.clear(true, true);
    this.crates.clear(true, true);
    this.projectiles.clear(true, true);
    this.enemyProjectiles.clear(true, true);

    GameState.adaptation = this.behaviorTracker.computeAdaptation();
    GameState.roundsCompleted += 1;
    GameState.snapshotCapital(`fin ronda ${GameState.currentRound}`);

    this.goToEconomy();
  }

  private goToEconomy() {
    this.scene.pause();
    this.scene.launch('Economy', {
      round: GameState.currentRound,
      onContinue: () => {
        this.scene.stop('Economy');
        this.player.damageReduction = GameState.damageReduction;
        this.scene.resume();
        this.startRound(GameState.currentRound + 1);
      },
    });
  }

  private startBossRound() {
    this.isBossRound = true;
    this.roundActive = true;

    this.enemies.clear(true, true);
    this.projectiles.clear(true, true);
    this.enemyProjectiles.clear(true, true);
    this.crates.clear(true, true);

    this.behaviorTracker.reset();

    const boss = new BossEnemy(this, ARENA.width / 2, ARENA.height / 2);
    this.enemies.add(boss);
    this.boss = boss;

    this.showBossHud(true);
    this.refreshHud();
  }

  private endGame(completed: boolean) {
    this.roundActive = false;
    this.spawnTimer?.remove();
    this.scene.start('Results', { completed });
  }

  // ------------------------------------------------------------- loop --

  update(_time: number, delta: number) {
    if (!this.roundActive) return;

    const cursors = this.cursors;
    const wasd = this.wasd;

    let vx = 0;
    let vy = 0;
    if (cursors.left.isDown || wasd.A.isDown) vx -= 1;
    if (cursors.right.isDown || wasd.D.isDown) vx += 1;
    if (cursors.up.isDown || wasd.W.isDown) vy -= 1;
    if (cursors.down.isDown || wasd.S.isDown) vy += 1;

    const joy = this.joystick.getVector();
    if (joy.x !== 0 || joy.y !== 0) {
      vx = joy.x;
      vy = joy.y;
    } else {
      const len = Math.hypot(vx, vy);
      if (len > 0) {
        vx /= len;
        vy /= len;
      }
    }

    this.player.move(vx, vy);

    const time = this.time.now;
    this.combatSystem.update(time);
    this.player.syncVisual(time);

    const livingEnemies = this.enemies.getChildren() as Enemy[];
    const ctx: EnemyContext = {
      scene: this,
      player: this.player,
      enemies: livingEnemies,
      enemyGroup: this.enemies,
      enemyProjectiles: this.enemyProjectiles,
      adaptation: GameState.adaptation,
      behaviorTracker: this.behaviorTracker,
      time,
      delta,
    };
    for (const enemy of livingEnemies) {
      if (!enemy.active) continue;
      enemy.update(ctx);
      if (enemy.isAttacking) {
        enemy.visual.triggerAttack(this.player.x - enemy.x, this.player.y - enemy.y, time);
      }
      enemy.syncVisual(time);
    }

    for (const obj of this.enemyProjectiles.getChildren()) {
      const projectile = obj as EnemyProjectile;
      if (projectile.isExpired(time)) {
        projectile.destroy();
      } else {
        projectile.syncVisual();
      }
    }

    this.updateCoinMagnet();

    GameState.survivalMs += delta;

    if (this.player.isDead) {
      this.endGame(false);
      return;
    }

    if (this.isBossRound) {
      this.refreshHud();
      return;
    }

    this.behaviorTracker.sample(this.player, livingEnemies, delta);
    this.roundSafetyRemaining -= delta;
    this.roundElapsedMs += delta;
    this.refreshHud();

    const roundCleared = this.enemySpawner.pending === 0 && livingEnemies.length === 0;
    if (roundCleared || this.roundSafetyRemaining <= 0) {
      this.endRound();
    }
  }

  private updateCoinMagnet() {
    for (const obj of this.coins.getChildren()) {
      const coin = obj as Coin;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, coin.x, coin.y);
      if (dist < COIN_MAGNET.range) {
        const dx = this.player.x - coin.x;
        const dy = this.player.y - coin.y;
        const len = Math.hypot(dx, dy) || 1;
        coin.body.setVelocity((dx / len) * COIN_MAGNET.speed, (dy / len) * COIN_MAGNET.speed);
      } else {
        coin.body.setVelocity(0, 0);
      }
    }
  }
}
