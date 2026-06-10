export type ListingStatus = "active" | "sold" | "removed" | "parseError";

export interface PricePoint {
  ts: number;
  price: number;
}

export interface TrackedListing {
  id: string;
  url: string;
  title: string;
  image: string;
  addedAt: number;
  status: ListingStatus;
  history: PricePoint[];
}

export interface Settings {
  checkIntervalHours: 1 | 6 | 24;
  notifyDrops: boolean;
  notifyAll: boolean;
}

export interface ParsedListing {
  id: string;
  title: string;
  price: number | null;
  image: string;
  availability: "InStock" | "SoldOut" | "unknown";
}
