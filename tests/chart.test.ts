import { formatDateShort, priceChart } from "../src/shared/chart";
import { sparklinePath } from "../src/shared/sparkline";

const DAY = 86400000;
const may27 = Date.UTC(2026, 4, 27);
const now = Date.UTC(2026, 5, 10);

const history = [
  { ts: may27, price: 650 },
  { ts: may27 + 5 * DAY, price: 600 },
  { ts: may27 + 10 * DAY, price: 550 },
  { ts: may27 + 13 * DAY, price: 500 },
];

test("formatDateShort renders Norwegian short dates deterministically", () => {
  expect(formatDateShort(may27)).toBe("27. mai");
});

test("sparkline is a time-proportional step path extended to now", () => {
  const p = sparklinePath([{ ts: 0, price: 1000 }, { ts: 50, price: 500 }], 120, 32, 2, 100);
  expect(p).toBe("M2.0,2.0 H60.0 V30.0 H118.0");
});

test("sparkline single point stays a flat line", () => {
  expect(sparklinePath([{ ts: 1, price: 500 }], 120, 32, 2)).toBe("M2.0,16.0 L118.0,16.0");
});

test("priceChart anchors the story: kr labels, date range, change dots", () => {
  const svg = priceChart(history, now);
  expect(svg).toContain("650 kr"); // max anchor
  expect(svg).toContain("500 kr"); // min anchor
  expect(svg).toContain("27. mai"); // start anchor
  expect(svg).toContain("i dag"); // end anchor
  expect(svg.match(/<circle/g)).toHaveLength(4); // one dot per change
  expect(svg).toContain("<path"); // the step line
});

test("priceChart with a single point shows one price and no misleading slope", () => {
  const svg = priceChart([{ ts: may27, price: 500 }], now);
  expect(svg).toContain("500 kr");
  expect(svg.match(/<circle/g)).toHaveLength(1);
  expect(svg.match(/500 kr/g)!.length).toBe(1); // min==max collapses to one label
});
