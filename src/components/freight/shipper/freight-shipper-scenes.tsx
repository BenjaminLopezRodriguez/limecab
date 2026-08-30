"use client";

import { Button } from "@/components/ui/button";

import {
  formatMiles,
  type FreightPlace,
  type FreightQuote,
} from "@/components/freight/freight-api";
import {
  BackRow,
  formatMoney,
  Row,
} from "@/components/freight/freight-parts";

/** Quote confirmation — simulated rates labeled before publish. */
export function QuoteScene({
  quote,
  pickup,
  delivery,
  busy,
  error,
  onBack,
  onPublish,
}: {
  quote: FreightQuote;
  pickup: FreightPlace | null;
  delivery: FreightPlace | null;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onPublish: () => void;
}) {
  return (
    <div className="pb-8 pt-2 md:pt-0">
      <BackRow label="Revise" onBack={onBack} />
      <h1 className="font-heading mt-4 text-2xl font-semibold tracking-[-0.03em]">
        Quote
      </h1>
      <p className="text-muted-foreground mt-1 text-[14px]">
        {pickup?.city ?? pickup?.address ?? "Pickup"} →{" "}
        {delivery?.city ?? delivery?.address ?? "Delivery"}
      </p>

      <dl className="mt-6 space-y-3 text-[15px]">
        <Row label="Distance" value={formatMiles(quote.distanceMeters)} />
        <Row
          label="Shipper total"
          value={formatMoney(quote.amountMinor, quote.currency)}
        />
        <Row
          label="Carrier rate"
          value={formatMoney(quote.carrierRateMinor, quote.currency)}
        />
        <Row label="Pricing" value={`${quote.pricingVersion} · Simulated`} />
      </dl>

      <p className="bg-accent text-accent-foreground mt-5 rounded-2xl px-4 py-3 text-[13px] leading-relaxed">
        Simulated price — not a market rate, not a charge.
      </p>

      {error ? (
        <p role="alert" className="text-destructive mt-4 text-[14px]">
          {error}
        </p>
      ) : null}

      <Button
        size="lg"
        className="mt-6 h-14 w-full text-[17px]"
        disabled={busy || !quote.loadId}
        aria-busy={busy || undefined}
        onClick={onPublish}
      >
        {busy ? "Publishing…" : "Publish shipment"}
      </Button>
    </div>
  );
}
