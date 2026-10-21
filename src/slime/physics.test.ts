import { describe, expect, it } from "vite-plus/test";
import { Slime } from "./physics.ts";

describe("Slime", () => {
  it("settles on the floor without collapsing or exploding", () => {
    const b = { w: 420, h: 420 };
    const s = new Slime(210, 150, 70);
    for (let f = 0; f < 600; f++) {
      if (f === 200) s.hop(400, -1200);
      s.step(1 / 60, b);
      for (let i = 0; i < s.n; i++) {
        expect(s.x[i]).toBeGreaterThanOrEqual(0);
        expect(s.x[i]).toBeLessThanOrEqual(b.w);
        expect(s.y[i]).toBeLessThanOrEqual(b.h);
      }
    }
    expect(s.grounded).toBe(true);
    expect(s.area() / s.restArea).toBeGreaterThan(0.85);
    expect(s.area() / s.restArea).toBeLessThan(1.1);
  });

  it("follows a drag", () => {
    const s = new Slime(100, 300, 50);
    s.startGrab(100, 300);
    for (let f = 0; f < 120; f++) {
      s.moveGrab(300, 150);
      s.step(1 / 60, { w: 420, h: 420 });
    }
    const c = s.centroid();
    expect(c.x).toBeGreaterThan(250);
    expect(c.y).toBeLessThan(220);
  });
});
