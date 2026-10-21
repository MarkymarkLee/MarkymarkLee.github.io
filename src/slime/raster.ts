// Turns the slime outline into a grid of pixel codes. Shared by the live canvas
// and the build (favicon, nav sprite, share image), so they all look the same.

export const EMPTY = 0,
  BODY = 1,
  EDGE = 2,
  SHINE = 3,
  EYE = 4,
  GLINT = 5;

export type Mood = "normal" | "blink" | "happy" | "dizzy";

export interface Face {
  mood: Mood;
  // Where the eyes look, each in [-1, 1].
  lookX: number;
  lookY: number;
}

export interface Grid {
  cols: number;
  rows: number;
  cells: Uint8Array;
}

export function makeGrid(cols: number, rows: number): Grid {
  return { cols, rows, cells: new Uint8Array(cols * rows) };
}

// Scanline fill: a cell is body when its centre is inside the polygon.
export function fillPolygon(g: Grid, xs: ArrayLike<number>, ys: ArrayLike<number>, cell: number) {
  const n = xs.length;
  let minY = Infinity,
    maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    minY = Math.min(minY, ys[i]);
    maxY = Math.max(maxY, ys[i]);
  }
  const r0 = Math.max(0, Math.floor(minY / cell));
  const r1 = Math.min(g.rows - 1, Math.ceil(maxY / cell));
  const cross: number[] = [];
  for (let r = r0; r <= r1; r++) {
    const yc = (r + 0.5) * cell;
    cross.length = 0;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      if (ys[i] > yc !== ys[j] > yc) {
        cross.push(xs[i] + ((yc - ys[i]) * (xs[j] - xs[i])) / (ys[j] - ys[i]));
      }
    }
    cross.sort((a, b) => a - b);
    for (let k = 0; k + 1 < cross.length; k += 2) {
      const c0 = Math.max(0, Math.ceil(cross[k] / cell - 0.5));
      const c1 = Math.min(g.cols - 1, Math.floor(cross[k + 1] / cell - 0.5));
      for (let c = c0; c <= c1; c++) g.cells[r * g.cols + c] = BODY;
    }
  }
}

function at(g: Grid, c: number, r: number): number {
  return c >= 0 && r >= 0 && c < g.cols && r < g.rows ? g.cells[r * g.cols + c] : EMPTY;
}

function set(g: Grid, c: number, r: number, v: number) {
  if (at(g, c, r) !== EMPTY) g.cells[r * g.cols + c] = v;
}

// Outline, highlight and face, drawn on top of a filled body.
// (cx, cy) is the body centre and (w, h) its size, all in cells.
export function decorate(g: Grid, cx: number, cy: number, w: number, h: number, face: Face) {
  const { cols, rows, cells } = g;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (cells[i] !== BODY) continue;
      const out =
        c === 0 ||
        r === 0 ||
        c === cols - 1 ||
        r === rows - 1 ||
        !cells[i - 1] ||
        !cells[i + 1] ||
        !cells[i - cols] ||
        !cells[i + cols];
      if (out) cells[i] = EDGE;
    }
  }

  // Highlight blob in the upper left.
  const hx = cx - w * 0.24,
    hy = cy - h * 0.24,
    hr = Math.max(0.8, Math.min(w, h) * 0.09);
  for (let r = Math.floor(hy - hr); r <= hy + hr; r++) {
    for (let c = Math.floor(hx - hr); c <= hx + hr; c++) {
      if ((c + 0.5 - hx) ** 2 + (r + 0.5 - hy) ** 2 <= hr * hr && at(g, c, r) === BODY) {
        set(g, c, r, SHINE);
      }
    }
  }

  const ew = Math.max(1, Math.round(w * 0.1));
  const eh = Math.max(2, Math.round(h * 0.2));
  const gap = Math.max(1, Math.round(w * 0.14));
  const ey = Math.round(cy - h * 0.08 + face.lookY * Math.max(1, h * 0.06));
  const shift = Math.round(face.lookX * Math.max(1, w * 0.08));
  const left = Math.round(cx) - gap - ew + shift;
  const right = Math.round(cx) + gap + shift;
  for (const ex of [left, right]) eye(g, ex, ey, ew, eh, face.mood);
}

function eye(g: Grid, x: number, y: number, ew: number, eh: number, mood: Mood) {
  const top = y - Math.floor(eh / 2);
  if (mood === "blink") {
    for (let c = 0; c < ew; c++) set(g, x + c, top + eh - 1, EYE);
    return;
  }
  if (mood === "happy") {
    // ^ shape
    const mid = x + (ew - 1) / 2;
    set(g, Math.floor(mid) - 1, top + 1, EYE);
    set(g, Math.floor(mid), top, EYE);
    set(g, Math.ceil(mid), top, EYE);
    set(g, Math.ceil(mid) + 1, top + 1, EYE);
    return;
  }
  if (mood === "dizzy") {
    // x shape, at least 3x3 so it reads as an x
    const s = Math.max(3, ew + 1);
    const ox = x + Math.floor((ew - s) / 2);
    for (let k = 0; k < s; k++) {
      set(g, ox + k, top + k, EYE);
      set(g, ox + s - 1 - k, top + k, EYE);
    }
    return;
  }
  for (let r = 0; r < eh; r++) for (let c = 0; c < ew; c++) set(g, x + c, top + r, EYE);
  if (eh >= 3) set(g, x, top, GLINT);
}

// Each row as runs of the same code, so drawing is one rect per run.
export function* runs(g: Grid): Generator<[code: number, col: number, row: number, len: number]> {
  for (let r = 0; r < g.rows; r++) {
    let c = 0;
    while (c < g.cols) {
      const v = g.cells[r * g.cols + c];
      let e = c + 1;
      while (e < g.cols && g.cells[r * g.cols + e] === v) e++;
      if (v !== EMPTY) yield [v, c, r, e - c];
      c = e;
    }
  }
}

// The resting slime used for static images: a dome with a flat-ish bottom.
export function spriteGrid(size = 16, face: Face = { mood: "normal", lookX: 0, lookY: 0 }): Grid {
  const g = makeGrid(size, size);
  const n = 40,
    xs: number[] = [],
    ys: number[] = [];
  const cx = size / 2,
    r = size * 0.47,
    floor = size - 0.6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    xs.push(cx + Math.cos(a) * r);
    ys.push(Math.min(floor, size * 0.56 + Math.sin(a) * r * 0.82));
  }
  fillPolygon(g, xs, ys, 1);
  const top = size * 0.56 - r * 0.82;
  decorate(g, cx, (top + floor) / 2 + 0.5, r * 2, floor - top, face);
  return g;
}
