import { appendIfChanged, formatPrice, priceChange } from "../src/core/history";

test("first point appends without 'changed'", () => {
  const r = appendIfChanged([], 500, 1000);
  expect(r.history).toEqual([{ ts: 1000, price: 500 }]);
  expect(r.changed).toBe(false);
  expect(r.prev).toBeNull();
});

test("same price appends nothing", () => {
  const h = [{ ts: 1000, price: 500 }];
  const r = appendIfChanged(h, 500, 2000);
  expect(r.history).toHaveLength(1);
  expect(r.changed).toBe(false);
});

test("new price appends and reports prev", () => {
  const r = appendIfChanged([{ ts: 1000, price: 500 }], 350, 2000);
  expect(r.history).toHaveLength(2);
  expect(r.changed).toBe(true);
  expect(r.prev).toBe(500);
});

test("formatPrice uses Norwegian grouping", () => {
  expect(formatPrice(10900)).toBe("10 900 kr");
  expect(formatPrice(500)).toBe("500 kr");
});

test("priceChange computes abs and pct from first to last", () => {
  expect(priceChange([{ ts: 1, price: 1000 }, { ts: 2, price: 750 }])).toEqual({ abs: -250, pct: -25 });
  expect(priceChange([{ ts: 1, price: 500 }])).toBeNull();
});
