const assert = require("node:assert/strict");
const test = require("node:test");
const { snapElementPosition, snapScalar, resizeRotatedElement } = require("../src/core/geometry");

test("snapScalar snaps within threshold", () => {
  assert.equal(snapScalar(10.2, [0, 10, 20], 0.4).value, 10);
  assert.equal(snapScalar(10.2, [0, 10, 20], 0.4).snapped, true);
  assert.equal(snapScalar(10.8, [0, 10, 20], 0.4).snapped, false);
});

test("snapElementPosition aligns element center to document center", () => {
  const document = { widthMm: 40, heightMm: 30 };
  // Center sits at ~19.8×14.8 — within 0.5 of 20×15.
  const element = { id: "a", x: 14.8, y: 11.8, width: 10, height: 6 };
  const result = snapElementPosition(element, document, [], 0.5);
  assert.ok(Math.abs(result.x - 15) < 1e-9, `x=${result.x}`);
  assert.ok(Math.abs(result.y - 12) < 1e-9, `y=${result.y}`);
  assert.ok(result.guides.some((g) => g.axis === "v"));
  assert.ok(result.guides.some((g) => g.axis === "h"));
});

test("mid-edge resize handle n changes height only", () => {
  const original = { x: 5, y: 5, width: 10, height: 8, rotation: 0 };
  const next = resizeRotatedElement(original, "n", { x: 0, y: -2 }, 1);
  assert.ok(next.height > original.height);
  assert.ok(Math.abs(next.width - original.width) < 1e-9);
});
