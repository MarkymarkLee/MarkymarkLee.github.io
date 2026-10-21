// Pressure soft body: a ring of nodes joined by springs, inflated by an
// internal pressure that pushes back whenever the enclosed area shrinks.

export interface Bounds {
  w: number;
  h: number;
}

const GRAVITY = 1800;
const EDGE_K = 3000;
const BEND_K = 900;
const SPRING_DAMP = 18;
const PRESSURE_K = 4500;
const SHAPE_K = 120;
const AIR_DAMP = 0.4;
const RESTITUTION = 0.35;
const WALL_FRICTION = 0.12;
const SUBSTEPS = 8;
const MAX_DT = 1 / 30;

export class Slime {
  readonly n: number;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly vx: Float64Array;
  readonly vy: Float64Array;
  readonly restArea: number;
  private readonly edgeRest: number;
  private readonly bendRest: number;
  private readonly restX: Float64Array;
  private readonly restY: Float64Array;
  private readonly fx: Float64Array;
  private readonly fy: Float64Array;

  // Dragging: node index -> offset from the pointer, kept while held.
  grab: { nodes: number[]; ox: number[]; oy: number[]; px: number; py: number } | null = null;
  // Fastest wall/floor hit since the last `consumeImpact()`, in px/s.
  private impact = 0;
  grounded = false;

  constructor(cx: number, cy: number, r: number, n = 28) {
    this.n = n;
    this.x = new Float64Array(n);
    this.y = new Float64Array(n);
    this.vx = new Float64Array(n);
    this.vy = new Float64Array(n);
    this.fx = new Float64Array(n);
    this.fy = new Float64Array(n);
    this.restX = new Float64Array(n);
    this.restY = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.restX[i] = Math.cos(a) * r;
      this.restY[i] = Math.sin(a) * r;
      this.x[i] = cx + this.restX[i];
      this.y[i] = cy + this.restY[i];
    }
    this.edgeRest = 2 * r * Math.sin(Math.PI / n);
    this.bendRest = 2 * r * Math.sin((2 * Math.PI) / n);
    this.restArea = this.area();
  }

  area(): number {
    let a = 0;
    for (let i = 0, j = this.n - 1; i < this.n; j = i++) {
      a += this.x[j] * this.y[i] - this.x[i] * this.y[j];
    }
    return a / 2;
  }

  centroid(): { x: number; y: number; vx: number; vy: number } {
    let x = 0,
      y = 0,
      vx = 0,
      vy = 0;
    for (let i = 0; i < this.n; i++) {
      x += this.x[i];
      y += this.y[i];
      vx += this.vx[i];
      vy += this.vy[i];
    }
    return { x: x / this.n, y: y / this.n, vx: vx / this.n, vy: vy / this.n };
  }

  contains(px: number, py: number): boolean {
    let inside = false;
    for (let i = 0, j = this.n - 1; i < this.n; j = i++) {
      const yi = this.y[i],
        yj = this.y[j];
      if (yi > py !== yj > py) {
        const xc = this.x[i] + ((py - yi) * (this.x[j] - this.x[i])) / (yj - yi);
        if (px < xc) inside = !inside;
      }
    }
    return inside;
  }

  startGrab(px: number, py: number) {
    let best = 0,
      bestD = Infinity;
    for (let i = 0; i < this.n; i++) {
      const d = (this.x[i] - px) ** 2 + (this.y[i] - py) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    // Hold a third of the ring so the body follows instead of stretching a single node.
    const span = Math.floor(this.n / 6);
    const nodes: number[] = [];
    for (let k = -span; k <= span; k++) nodes.push((best + k + this.n) % this.n);
    this.grab = {
      nodes,
      ox: nodes.map((i) => this.x[i] - px),
      oy: nodes.map((i) => this.y[i] - py),
      px,
      py,
    };
  }

  moveGrab(px: number, py: number) {
    if (this.grab) {
      this.grab.px = px;
      this.grab.py = py;
    }
  }

  endGrab() {
    this.grab = null;
  }

  hop(vx: number, vy: number) {
    for (let i = 0; i < this.n; i++) {
      this.vx[i] += vx;
      this.vy[i] += vy;
    }
  }

  consumeImpact(): number {
    const v = this.impact;
    this.impact = 0;
    return v;
  }

  step(dt: number, b: Bounds) {
    const h = Math.min(dt, MAX_DT) / SUBSTEPS;
    this.grounded = false;
    for (let s = 0; s < SUBSTEPS; s++) this.substep(h, b);
  }

  private spring(i: number, j: number, rest: number, k: number) {
    const dx = this.x[j] - this.x[i],
      dy = this.y[j] - this.y[i];
    const len = Math.hypot(dx, dy) || 1e-6;
    const ux = dx / len,
      uy = dy / len;
    const relV = (this.vx[j] - this.vx[i]) * ux + (this.vy[j] - this.vy[i]) * uy;
    const f = k * (len - rest) + SPRING_DAMP * relV;
    this.fx[i] += f * ux;
    this.fy[i] += f * uy;
    this.fx[j] -= f * ux;
    this.fy[j] -= f * uy;
  }

  private substep(h: number, b: Bounds) {
    const { n, x, y, vx, vy, fx, fy } = this;
    fx.fill(0);
    fy.fill(GRAVITY);

    for (let i = 0; i < n; i++) {
      this.spring(i, (i + 1) % n, this.edgeRest, EDGE_K);
      this.spring(i, (i + 2) % n, this.bendRest, BEND_K);
    }

    // Pressure acts along each edge's outward normal (ring is counter-clockwise in screen space).
    const p = (PRESSURE_K * (this.restArea - this.area())) / this.restArea;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const ex = x[j] - x[i],
        ey = y[j] - y[i];
      // Outward normal scaled by edge length: (ey, -ex) for positive shoelace area.
      const nx = ey * p * 0.5,
        ny = -ex * p * 0.5;
      fx[i] += nx;
      fy[i] += ny;
      fx[j] += nx;
      fy[j] += ny;
    }

    // Shape matching (rotation-free) pulls the ring back toward a circle so it doesn't pancake.
    let cx = 0,
      cy = 0;
    for (let i = 0; i < n; i++) {
      cx += x[i];
      cy += y[i];
    }
    cx /= n;
    cy /= n;
    for (let i = 0; i < n; i++) {
      fx[i] += (cx + this.restX[i] - x[i]) * SHAPE_K;
      fy[i] += (cy + this.restY[i] - y[i]) * SHAPE_K;
    }

    if (this.grab) {
      const g = this.grab;
      for (let k = 0; k < g.nodes.length; k++) {
        const i = g.nodes[k];
        fx[i] += (g.px + g.ox[k] - x[i]) * 400 - vx[i] * 30;
        fy[i] += (g.py + g.oy[k] - y[i]) * 400 - vy[i] * 30 - GRAVITY;
      }
    }

    const air = 1 - AIR_DAMP * h;
    for (let i = 0; i < n; i++) {
      vx[i] = (vx[i] + fx[i] * h) * air;
      vy[i] = (vy[i] + fy[i] * h) * air;
      x[i] += vx[i] * h;
      y[i] += vy[i] * h;

      if (y[i] > b.h) {
        y[i] = b.h;
        if (vy[i] > 0) {
          this.impact = Math.max(this.impact, vy[i]);
          vy[i] *= -RESTITUTION;
        }
        vx[i] *= 1 - WALL_FRICTION;
        this.grounded = true;
      } else if (y[i] < 0) {
        y[i] = 0;
        if (vy[i] < 0) {
          this.impact = Math.max(this.impact, -vy[i]);
          vy[i] *= -RESTITUTION;
        }
        vx[i] *= 1 - WALL_FRICTION;
      }
      if (x[i] < 0) {
        x[i] = 0;
        if (vx[i] < 0) {
          this.impact = Math.max(this.impact, -vx[i]);
          vx[i] *= -RESTITUTION;
        }
        vy[i] *= 1 - WALL_FRICTION;
      } else if (x[i] > b.w) {
        x[i] = b.w;
        if (vx[i] > 0) {
          this.impact = Math.max(this.impact, vx[i]);
          vx[i] *= -RESTITUTION;
        }
        vy[i] *= 1 - WALL_FRICTION;
      }
    }
  }
}
