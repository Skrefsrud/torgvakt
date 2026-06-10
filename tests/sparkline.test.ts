import { sparklinePath } from "../src/shared/sparkline";

test("empty history gives empty path", () => {
  expect(sparklinePath([])).toBe("");
});

test("single point renders a flat line", () => {
  const p = sparklinePath([{ ts: 1, price: 500 }], 120, 32, 2);
  expect(p).toBe("M2.0,16.0 L118.0,16.0");
});

test("two points span the width, lower price is lower on canvas", () => {
  const p = sparklinePath([{ ts: 1, price: 1000 }, { ts: 2, price: 500 }], 120, 32, 2);
  expect(p).toBe("M2.0,2.0 L118.0,30.0");
});
