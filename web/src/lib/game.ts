import {
  Application,
  Container,
  Graphics,
  Text,
  TextStyle,
  Ticker,
  FederatedPointerEvent,
} from "pixi.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export type Phase = "menu" | "playing" | "over";

export interface GameCallbacks {
  onPhaseChange: (phase: Phase) => void;
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onComboChange: (combo: number) => void;
  onHighScore: (score: number) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_LIVES = 3;
const BASE_ORB_SPEED = 120; // px/s
const SPEED_INCREMENT = 8;  // px/s per orb caught
const SPAWN_BASE = 1.8;     // seconds between spawns
const SPAWN_MIN = 0.45;
const BASKET_W = 90;
const BASKET_H = 28;
const BASKET_SPEED = 480;   // px/s keyboard
const ORB_RADIUS = 18;

const ORB_COLORS = [0xff4dff, 0x4dffff, 0xffff4d, 0x4dff88, 0xff6b4d, 0x4d88ff];
const GLOW_COLORS = [0xff00ff, 0x00ffff, 0xffff00, 0x00ff88, 0xff4400, 0x0066ff];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function randomBetween(a: number, b: number) {
  return a + Math.random() * (b - a);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function colorIndex(idx: number) {
  return idx % ORB_COLORS.length;
}

// ─── Particle ────────────────────────────────────────────────────────────────

interface Particle {
  gfx: Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: number;
}

function spawnBurst(
  stage: Container,
  particles: Particle[],
  x: number,
  y: number,
  _color: number,   // kept for API symmetry; actual tint comes from glowColor
  glowColor: number,
) {
  const count = 18;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + randomBetween(-0.2, 0.2);
    const speed = randomBetween(60, 220);
    const g = new Graphics();
    const r = randomBetween(3, 7);
    g.circle(0, 0, r).fill({ color: glowColor, alpha: 0.85 });
    g.circle(0, 0, r * 0.5).fill({ color: 0xffffff, alpha: 0.9 });
    g.position.set(x, y);
    stage.addChild(g);
    particles.push({
      gfx: g,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      maxLife: randomBetween(0.45, 0.8),
      color: glowColor,
    });
  }
}

function updateParticles(particles: Particle[], dt: number) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]!;
    p.life -= dt / p.maxLife;
    if (p.life <= 0) {
      p.gfx.parent?.removeChild(p.gfx);
      p.gfx.destroy();
      particles.splice(i, 1);
      continue;
    }
    p.gfx.position.x += p.vx * dt;
    p.gfx.position.y += p.vy * dt;
    p.vy += 180 * dt; // gravity
    p.gfx.alpha = p.life * p.life;
    p.gfx.scale.set(p.life);
  }
}

// ─── Orb ─────────────────────────────────────────────────────────────────────

interface Orb {
  container: Container;
  gfx: Graphics;
  glowGfx: Graphics;
  x: number;
  y: number;
  speed: number;
  colorIdx: number;
  phase: number; // wobble phase
}

function makeOrb(stage: Container, x: number, colorIdx: number, speed: number): Orb {
  const ci = colorIndex(colorIdx);
  const col = ORB_COLORS[ci]!;
  const glowCol = GLOW_COLORS[ci]!;

  const container = new Container();
  container.position.set(x, -ORB_RADIUS * 2);

  // glow ring (outer)
  const glowGfx = new Graphics();
  glowGfx.circle(0, 0, ORB_RADIUS + 8).fill({ color: glowCol, alpha: 0.22 });
  glowGfx.circle(0, 0, ORB_RADIUS + 4).fill({ color: glowCol, alpha: 0.18 });
  container.addChild(glowGfx);

  // orb body
  const gfx = new Graphics();
  gfx.circle(0, 0, ORB_RADIUS).fill({ color: col, alpha: 0.95 });
  gfx.circle(-5, -5, ORB_RADIUS * 0.45).fill({ color: 0xffffff, alpha: 0.35 });
  container.addChild(gfx);

  stage.addChild(container);

  return { container, gfx, glowGfx, x, y: -ORB_RADIUS * 2, speed, colorIdx: ci, phase: Math.random() * Math.PI * 2 };
}

// ─── Basket ───────────────────────────────────────────────────────────────────

function drawBasket(gfx: Graphics, glowGfx: Graphics, w: number, h: number) {
  gfx.clear();
  glowGfx.clear();

  // glow aura
  glowGfx.roundRect(-w / 2 - 8, -h / 2 - 8, w + 16, h + 16, 20).fill({ color: 0x00ffff, alpha: 0.12 });
  glowGfx.roundRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8, 16).fill({ color: 0x00ffff, alpha: 0.18 });

  // basket body
  gfx.roundRect(-w / 2, -h / 2, w, h, 10).fill({ color: 0x0a2a3a, alpha: 1 });
  gfx.roundRect(-w / 2, -h / 2, w, h, 10).stroke({ color: 0x00ffff, width: 2.5, alpha: 0.9 });

  // rim highlight
  gfx.roundRect(-w / 2 + 4, -h / 2 + 3, w - 8, 4, 3).fill({ color: 0x00ffff, alpha: 0.4 });
}

// ─── Star field ───────────────────────────────────────────────────────────────

interface Star {
  gfx: Graphics;
  speed: number;
  baseAlpha: number;
  phase: number;
}

function makeStars(stage: Container, count: number, w: number, h: number): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    const g = new Graphics();
    const r = randomBetween(0.5, 2);
    g.circle(0, 0, r).fill({ color: 0xffffff, alpha: 0.7 });
    g.position.set(randomBetween(0, w), randomBetween(0, h));
    const alpha = randomBetween(0.2, 0.7);
    g.alpha = alpha;
    stage.addChild(g);
    stars.push({ gfx: g, speed: randomBetween(0.4, 1.2), baseAlpha: alpha, phase: randomBetween(0, Math.PI * 2) });
  }
  return stars;
}

// ─── Combo flash ─────────────────────────────────────────────────────────────

interface ComboFlash {
  gfx: Graphics;
  life: number;
}

// ─── Main Game Controller ────────────────────────────────────────────────────

export class OrbCascadeGame {
  private app: Application;
  private callbacks: GameCallbacks;
  private phase: Phase = "menu";

  // Layers
  private bgLayer!: Container;
  private gameLayer!: Container;
  private fxLayer!: Container;
  private uiLayer!: Container;

  // Stars
  private stars: Star[] = [];

  // Basket
  private basketContainer!: Container;
  private basketGfx!: Graphics;
  private basketGlowGfx!: Graphics;
  private basketX = 0;
  private targetX = 0;

  // Orbs
  private orbs: Orb[] = [];
  private orbColorCounter = 0;
  private spawnTimer = 0;
  private spawnInterval = SPAWN_BASE;

  // Game state
  private score = 0;
  private lives = MAX_LIVES;
  private combo = 0;
  private orbSpeed = BASE_ORB_SPEED;
  private totalCaught = 0;

  // High score
  private highScore = 0;

  // Particles
  private particles: Particle[] = [];

  // Combo flashes
  private comboFlashes: ComboFlash[] = [];

  // Input
  private keys: Record<string, boolean> = {};
  private pointerTargetX: number | null = null;

  // Ticker
  private tickerFn!: (ticker: Ticker) => void;

  // Time
  private elapsed = 0;

  // Screen flash
  private screenFlash = 0;
  private screenFlashColor = 0xff0000;

  constructor(app: Application, callbacks: GameCallbacks) {
    this.app = app;
    this.callbacks = callbacks;

    const stored = localStorage.getItem("orb-cascade_highscore");
    this.highScore = stored ? parseInt(stored, 10) || 0 : 0;

    this.buildLayers();
    this.buildStars();
    this.buildBasket();
    this.setupInput();
    this.startTicker();

    this.showMenu();
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  private buildLayers() {
    this.bgLayer = new Container();
    this.gameLayer = new Container();
    this.fxLayer = new Container();
    this.uiLayer = new Container();
    this.app.stage.addChild(this.bgLayer);
    this.app.stage.addChild(this.gameLayer);
    this.app.stage.addChild(this.fxLayer);
    this.app.stage.addChild(this.uiLayer);
  }

  private buildStars() {
    const { width, height } = this.app.screen;
    this.stars = makeStars(this.bgLayer, 80, width, height);
  }

  private buildBasket() {
    this.basketContainer = new Container();
    this.basketGlowGfx = new Graphics();
    this.basketGfx = new Graphics();
    this.basketContainer.addChild(this.basketGlowGfx);
    this.basketContainer.addChild(this.basketGfx);
    drawBasket(this.basketGfx, this.basketGlowGfx, BASKET_W, BASKET_H);
    this.gameLayer.addChild(this.basketContainer);

    const { width, height } = this.app.screen;
    this.basketX = width / 2;
    this.targetX = width / 2;
    this.basketContainer.position.set(this.basketX, height - 50);
    this.basketContainer.visible = false;
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  private setupInput() {
    const onKey = (e: KeyboardEvent, down: boolean) => {
      this.keys[e.key] = down;
      if (down && (e.key === " " || e.key === "Enter")) {
        if (this.phase === "menu" || this.phase === "over") this.startGame();
      }
    };
    window.addEventListener("keydown", (e) => onKey(e, true));
    window.addEventListener("keyup", (e) => onKey(e, false));

    this.app.stage.eventMode = "static";
    this.app.stage.hitArea = this.app.screen;

    this.app.stage.on("pointermove", (e: FederatedPointerEvent) => {
      if (this.phase === "playing") {
        const local = e.getLocalPosition(this.app.stage);
        this.pointerTargetX = local.x;
      }
    });

    this.app.stage.on("pointerdown", (e: FederatedPointerEvent) => {
      if (this.phase === "playing") {
        const local = e.getLocalPosition(this.app.stage);
        this.pointerTargetX = local.x;
      } else if (this.phase === "menu" || this.phase === "over") {
        this.startGame();
      }
    });
  }

  // ── Ticker ─────────────────────────────────────────────────────────────────

  private startTicker() {
    this.tickerFn = (ticker: Ticker) => {
      const dt = ticker.deltaMS / 1000;
      this.elapsed += dt;
      this.update(dt);
    };
    this.app.ticker.add(this.tickerFn);
  }

  // ── Phase Management ───────────────────────────────────────────────────────

  private showMenu() {
    this.phase = "menu";
    this.callbacks.onPhaseChange("menu");
    this.basketContainer.visible = false;
    this.clearOrbs();
    this.clearParticles();
  }

  startGame() {
    this.phase = "playing";
    this.callbacks.onPhaseChange("playing");

    this.score = 0;
    this.lives = MAX_LIVES;
    this.combo = 0;
    this.orbSpeed = BASE_ORB_SPEED;
    this.totalCaught = 0;
    this.spawnTimer = 0;
    this.spawnInterval = SPAWN_BASE;
    this.elapsed = 0;
    this.pointerTargetX = null;

    const { width, height } = this.app.screen;
    this.basketX = width / 2;
    this.targetX = width / 2;
    this.basketContainer.position.set(this.basketX, height - 50);
    this.basketContainer.visible = true;

    this.callbacks.onScoreChange(0);
    this.callbacks.onLivesChange(MAX_LIVES);
    this.callbacks.onComboChange(0);

    this.clearOrbs();
    this.clearParticles();
  }

  private endGame() {
    this.phase = "over";
    this.callbacks.onPhaseChange("over");
    this.basketContainer.visible = false;

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem("orb-cascade_highscore", String(this.score));
      this.callbacks.onHighScore(this.score);
    }

    // big screen flash
    this.screenFlash = 1;
    this.screenFlashColor = 0xff2244;

    this.clearOrbs();
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  private update(dt: number) {
    this.animateStars(dt);

    if (this.phase === "playing") {
      this.updateBasket(dt);
      this.updateSpawner(dt);
      this.updateOrbs(dt);
    }

    updateParticles(this.particles, dt);
    this.updateComboFlashes(dt);
    this.updateScreenFlash(dt);
  }

  private animateStars(dt: number) {
    for (const s of this.stars) {
      s.phase += dt * s.speed;
      s.gfx.alpha = s.baseAlpha * (0.6 + 0.4 * Math.sin(s.phase));
    }
  }

  private updateBasket(dt: number) {
    const { width } = this.app.screen;
    const half = BASKET_W / 2;

    // Keyboard
    if (this.keys["ArrowLeft"] || this.keys["a"] || this.keys["A"]) {
      this.targetX -= BASKET_SPEED * dt;
    }
    if (this.keys["ArrowRight"] || this.keys["d"] || this.keys["D"]) {
      this.targetX += BASKET_SPEED * dt;
    }

    // Pointer
    if (this.pointerTargetX !== null) {
      this.targetX = this.pointerTargetX;
    }

    this.targetX = Math.max(half, Math.min(width - half, this.targetX));
    this.basketX = lerp(this.basketX, this.targetX, Math.min(1, dt * 14));
    this.basketX = Math.max(half, Math.min(width - half, this.basketX));

    const { height } = this.app.screen;
    this.basketContainer.position.set(this.basketX, height - 50);

    // Pulse glow on combo
    const pulse = this.combo > 0 ? 0.9 + 0.1 * Math.sin(this.elapsed * 8) : 1;
    this.basketGlowGfx.alpha = pulse;
  }

  private updateSpawner(dt: number) {
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.spawnOrb();
    }
  }

  private spawnOrb() {
    const { width } = this.app.screen;
    const margin = ORB_RADIUS + 10;
    const x = randomBetween(margin, width - margin);
    const orb = makeOrb(this.gameLayer, x, this.orbColorCounter++, this.orbSpeed);
    this.orbs.push(orb);
  }

  private updateOrbs(dt: number) {
    const { height } = this.app.screen;
    const basketY = height - 50;
    const catchDist = BASKET_W / 2 + ORB_RADIUS * 0.6;
    const catchYRange = BASKET_H / 2 + ORB_RADIUS;

    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const orb = this.orbs[i]!;

      // Wobble
      orb.phase += dt * 2.5;
      orb.y += orb.speed * dt;
      const wobbleX = Math.sin(orb.phase) * 6;
      orb.container.position.set(orb.x + wobbleX, orb.y);

      // Pulse glow
      const glowPulse = 0.8 + 0.2 * Math.sin(orb.phase * 1.5);
      orb.glowGfx.alpha = glowPulse;

      // Check catch
      const dx = Math.abs(orb.x + wobbleX - this.basketX);
      const dy = Math.abs(orb.y - basketY);
      if (dx < catchDist && dy < catchYRange) {
        this.catchOrb(orb, i);
        continue;
      }

      // Missed
      if (orb.y > height + ORB_RADIUS * 2) {
        this.missOrb(orb, i);
      }
    }
  }

  private catchOrb(orb: Orb, idx: number) {
    const ci = orb.colorIdx;
    const glowCol = GLOW_COLORS[ci]!;

    spawnBurst(this.fxLayer, this.particles, orb.container.position.x, orb.container.position.y, ORB_COLORS[ci]!, glowCol);

    orb.container.parent?.removeChild(orb.container);
    orb.container.destroy();
    this.orbs.splice(idx, 1);

    this.combo++;
    this.totalCaught++;

    // Score: base 10 * combo multiplier
    const multiplier = Math.max(1, this.combo);
    const points = 10 * multiplier;
    this.score += points;

    // Speed up
    this.orbSpeed = BASE_ORB_SPEED + this.totalCaught * SPEED_INCREMENT;
    // Spawn faster
    this.spawnInterval = Math.max(SPAWN_MIN, SPAWN_BASE - this.totalCaught * 0.03);

    this.callbacks.onScoreChange(this.score);
    this.callbacks.onComboChange(this.combo);

    // Combo flash text
    if (this.combo >= 2) {
      this.spawnComboFlash(orb.container.position.x, orb.container.position.y, this.combo, glowCol);
    }

    // Screen flash (green tint)
    this.screenFlash = 0.18;
    this.screenFlashColor = glowCol;
  }

  private missOrb(orb: Orb, idx: number) {
    orb.container.parent?.removeChild(orb.container);
    orb.container.destroy();
    this.orbs.splice(idx, 1);

    this.combo = 0;
    this.lives--;
    this.callbacks.onLivesChange(this.lives);
    this.callbacks.onComboChange(0);

    // Red flash
    this.screenFlash = 0.38;
    this.screenFlashColor = 0xff2244;

    if (this.lives <= 0) {
      this.endGame();
    }
  }

  // ── Combo Flash ───────────────────────────────────────────────────────────

  private spawnComboFlash(x: number, y: number, combo: number, color: number) {
    const g = new Graphics();
    // Draw a glowing text-like pill
    const label = `×${combo}`;
    const style = new TextStyle({
      fontFamily: "Fraunces, serif",
      fontSize: 22 + Math.min(combo * 3, 20),
      fill: color,
      fontWeight: "700",
      dropShadow: {
        color: color,
        blur: 12,
        distance: 0,
        alpha: 0.9,
      },
    });
    const txt = new Text({ text: label, style });
    txt.anchor.set(0.5);
    txt.position.set(x, y - 20);
    this.fxLayer.addChild(txt);

    const flash: ComboFlash = { gfx: g, life: 1 };
    // Attach text to the gfx container for lifecycle management
    (flash as unknown as { txt: Text }).txt = txt;
    this.comboFlashes.push(flash);
  }

  private updateComboFlashes(dt: number) {
    for (let i = this.comboFlashes.length - 1; i >= 0; i--) {
      const f = this.comboFlashes[i]!;
      f.life -= dt * 1.8;
      const txt = (f as unknown as { txt: Text }).txt as Text | undefined;
      if (txt) {
        txt.position.y -= 40 * dt;
        txt.alpha = Math.max(0, f.life);
        txt.scale.set(0.8 + 0.2 * (1 - f.life));
      }
      if (f.life <= 0) {
        if (txt) {
          txt.parent?.removeChild(txt);
          txt.destroy();
        }
        f.gfx.parent?.removeChild(f.gfx);
        f.gfx.destroy();
        this.comboFlashes.splice(i, 1);
      }
    }
  }

  // ── Screen Flash ──────────────────────────────────────────────────────────

  private flashGfx: Graphics | null = null;

  private updateScreenFlash(dt: number) {
    if (this.screenFlash <= 0) {
      if (this.flashGfx) this.flashGfx.alpha = 0;
      return;
    }
    if (!this.flashGfx) {
      this.flashGfx = new Graphics();
      this.uiLayer.addChild(this.flashGfx);
    }
    const { width, height } = this.app.screen;
    this.flashGfx.clear();
    this.flashGfx.rect(0, 0, width, height).fill({ color: this.screenFlashColor, alpha: this.screenFlash });
    this.screenFlash = Math.max(0, this.screenFlash - dt * 3.5);
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  private clearOrbs() {
    for (const orb of this.orbs) {
      orb.container.parent?.removeChild(orb.container);
      orb.container.destroy();
    }
    this.orbs = [];
  }

  private clearParticles() {
    for (const p of this.particles) {
      p.gfx.parent?.removeChild(p.gfx);
      p.gfx.destroy();
    }
    this.particles = [];
  }

  // ── Public ────────────────────────────────────────────────────────────────

  getHighScore() {
    return this.highScore;
  }

  destroy() {
    this.app.ticker.remove(this.tickerFn);
    window.removeEventListener("keydown", () => {});
    window.removeEventListener("keyup", () => {});
  }
}
