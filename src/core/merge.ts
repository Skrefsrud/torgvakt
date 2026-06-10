import type { TrackedListing } from "../shared/types";

export interface CycleOps {
  /** Listings whose state changed during the check cycle (same id). */
  updates: TrackedListing[];
  /** Relist rebinds: old entry replaced by a new id. */
  rebinds: { oldId: string; listing: TrackedListing }[];
}

/**
 * Merges a check cycle's results into a FRESH read of storage. The cycle works
 * on a snapshot for many seconds; the user may track/untrack meanwhile. Rules:
 * never resurrect entries the user removed, never drop entries the user added.
 */
export function applyCycleOps(
  fresh: Record<string, TrackedListing>,
  ops: CycleOps,
): Record<string, TrackedListing> {
  for (const u of ops.updates) {
    if (u.id in fresh) fresh[u.id] = u;
  }
  for (const r of ops.rebinds) {
    if (r.oldId in fresh) {
      delete fresh[r.oldId];
      fresh[r.listing.id] = r.listing;
    }
  }
  return fresh;
}
