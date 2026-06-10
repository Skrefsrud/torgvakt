import { canTrack, FREE_TRACK_LIMIT } from "../src/core/limits";

test("v1 launch config is unlimited", () => {
  expect(FREE_TRACK_LIMIT).toBe(Infinity);
  expect(canTrack(9999)).toBe(true);
});

test("gate respects a finite limit", () => {
  expect(canTrack(2, 3)).toBe(true);
  expect(canTrack(3, 3)).toBe(false);
});
