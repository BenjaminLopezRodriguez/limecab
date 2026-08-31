/** Deterministic partner fixtures. */

export type PartnerListing = {
  id: string;
  name: string;
  address: string;
  status: "live" | "paused" | "draft";
  category: string;
};

export const PARTNER_LISTINGS: PartnerListing[] = [
  { id: "p1", name: "Blue Bottle Coffee", address: "300 S Broadway", status: "live", category: "Café" },
  { id: "p2", name: "Grand Central Market", address: "317 S Broadway", status: "live", category: "Market" },
  { id: "p3", name: "The Broad", address: "221 S Grand Ave", status: "paused", category: "Museum" },
  { id: "p4", name: "New listing", address: "—", status: "draft", category: "Retail" },
];

export const PARTNER_TABS = ["Places", "Insights", "Settings"] as const;
