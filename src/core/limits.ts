// Dormant paywall. Freemium flip = set FREE_TRACK_LIMIT to a finite number and wire
// ExtensionPay to bypass the gate for paid users. Decided 2026-06-10: stays Infinity
// until the Phase 2 willingness-to-pay gate passes.
export const FREE_TRACK_LIMIT = Infinity;

export function canTrack(currentCount: number, limit: number = FREE_TRACK_LIMIT): boolean {
  return currentCount < limit;
}
