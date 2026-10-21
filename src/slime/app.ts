import { Slime } from "./physics.ts";
import {
  decorate,
  fillPolygon,
  makeGrid,
  runs,
  spriteGrid,
  type Grid,
  type Mood,
} from "./raster.ts";

const CELL = 6;
// Intro: smooth circle that steps down into chunky pixels.
const INTRO: [time: number, cell: number][] = [
  [0, 1],
  [0.7, 2],
  [0.85, 3],
  [1.0, 4],
  [1.15, CELL],
];
const DIZZY_IMPACT = 1100;

// Palette slot per raster code, read from CSS so it follows the theme.
const VARS = ["", "--slime", "--slime-edge", "--slime-shine", "--slime-eye", "--slime-glint"];

export function mountSlime(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")!;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const touch = matchMedia("(pointer: coarse)").matches;
  let colors: string[] = [];
  const readColors = () => {
    const cs = getComputedStyle(canvas);
    colors = VARS.map((v) => (v ? cs.getPropertyValue(v).trim() : ""));
  };

  let w = 0,
    h = 0,
    dpr = 1;
  let slime: Slime | null = null;
  let grid: Grid = makeGrid(1, 1);

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    w = rect.width;
    h = rect.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    if (!slime) {
      const r = Math.max(36, Math.min(80, Math.min(w, h) * 0.17));
      slime = new Slime(w / 2, Math.min(h * 0.35, h - r - 4), r);
    }
    if (reduced) drawStatic();
  };

  // Mood state
  let t = 0;
  let nextBlink = 2;
  let blinkUntil = 0;
  let dizzyUntil = 0;
  let still = 0;
  let pointer: { x: number; y: number; at: number } | null = null;

  const local = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  canvas.addEventListener("pointerdown", (e) => {
    if (!slime || reduced) return;
    const p = local(e);
    if (slime.contains(p.x, p.y)) {
      canvas.setPointerCapture(e.pointerId);
      slime.startGrab(p.x, p.y);
      canvas.classList.add("grabbing");
    } else if (slime.grounded) {
      // Tap on empty space: hop toward it.
      const c = slime.centroid();
      slime.hop(Math.sign(p.x - c.x) * 260, -700);
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    const p = local(e);
    slime?.moveGrab(p.x, p.y);
  });
  const release = () => {
    slime?.endGrab();
    canvas.classList.remove("grabbing");
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  // Eyes follow the cursor anywhere on the page.
  window.addEventListener("pointermove", (e) => {
    const p = local(e);
    pointer = { ...p, at: t };
  });

  function behave(dt: number): Mood {
    const s = slime!;
    if (s.consumeImpact() > DIZZY_IMPACT && !s.grab) dizzyUntil = t + 1.8;
    if (t > nextBlink) {
      blinkUntil = t + 0.12;
      nextBlink = t + 2 + Math.random() * 3;
    }
    const c = s.centroid();
    const calm = s.grounded && Math.hypot(c.vx, c.vy) < 40 && !s.grab;
    still = calm ? still + dt : 0;
    if (still > (touch ? 1.6 : 4) && t > dizzyUntil) {
      still = 0;
      // Hop away from the nearer wall, sometimes a big one.
      const dir = c.x < w / 2 ? 1 : -1;
      const big = Math.random() < 0.3;
      s.hop(dir * (120 + Math.random() * 200), -(big ? 950 : 600));
    }
    if (s.grab) return "happy";
    if (t < dizzyUntil) return "dizzy";
    if (t < blinkUntil) return "blink";
    return "normal";
  }

  function look(): [number, number] {
    const s = slime!;
    const c = s.centroid();
    let dx: number, dy: number;
    if (pointer && t - pointer.at < 3) {
      dx = pointer.x - c.x;
      dy = pointer.y - c.y;
    } else {
      dx = c.vx;
      dy = c.vy;
    }
    const len = Math.hypot(dx, dy);
    if (len < 1) return [0, 0];
    return [dx / len, dy / len];
  }

  function draw(cell: number, mood: Mood) {
    const s = slime!;
    const cols = Math.ceil(w / cell),
      rows = Math.ceil(h / cell);
    if (grid.cols !== cols || grid.rows !== rows) grid = makeGrid(cols, rows);
    else grid.cells.fill(0);
    fillPolygon(grid, s.x, s.y, cell);
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (let i = 0; i < s.n; i++) {
      minX = Math.min(minX, s.x[i]);
      maxX = Math.max(maxX, s.x[i]);
      minY = Math.min(minY, s.y[i]);
      maxY = Math.max(maxY, s.y[i]);
    }
    const [lookX, lookY] = look();
    decorate(
      grid,
      (minX + maxX) / 2 / cell,
      (minY + maxY) / 2 / cell,
      (maxX - minX) / cell,
      (maxY - minY) / cell,
      { mood, lookX, lookY },
    );
    paint(grid, cell);
  }

  function paint(g: Grid, cell: number, ox = 0, oy = 0) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    for (const [code, c, r, len] of runs(g)) {
      ctx.fillStyle = colors[code];
      ctx.fillRect(ox + c * cell, oy + r * cell, len * cell, cell);
    }
  }

  function drawStatic() {
    readColors();
    const g = spriteGrid(24);
    const cell = Math.max(2, Math.floor(Math.min(w, h) / 2 / 24));
    paint(g, cell, (w - 24 * cell) / 2, h - 24 * cell);
  }

  let raf = 0;
  let last = 0;
  let visible = true;
  const frame = (now: number) => {
    const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
    last = now;
    t += dt;
    const s = slime!;
    s.step(dt, { w, h });
    let cell = CELL;
    for (const [at, c] of INTRO) if (t >= at) cell = c;
    draw(cell, t < INTRO[INTRO.length - 1][0] ? "normal" : behave(dt));
    raf = requestAnimationFrame(frame);
  };
  const run = () => {
    cancelAnimationFrame(raf);
    if (visible && !document.hidden && !reduced) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  };

  readColors();
  new ResizeObserver(resize).observe(canvas);
  resize();
  // Pause while scrolled away or in a background tab.
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    run();
  }).observe(canvas);
  document.addEventListener("visibilitychange", run);
  document.addEventListener("themechange", () => (reduced ? drawStatic() : readColors()));
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () =>
    reduced ? drawStatic() : readColors(),
  );
}
