"use client";

import { TabPage } from "@/components/limecab/limecab-shell";
import { Button } from "@/components/ui/button";

export default function ActivityError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <TabPage title="Activity">
      <div className="ring-border flex flex-col items-center rounded-2xl px-5 py-12 text-center ring-1">
        <p className="text-[15px] font-medium tracking-tight">
          We couldn&rsquo;t load your trips
        </p>
        <p className="text-muted-foreground mt-2 max-w-xs text-sm leading-relaxed">
          Nothing was lost. Try again in a moment.
        </p>
        <Button onClick={reset} className="mt-6 h-12 rounded-xl px-5">
          Try again
        </Button>
      </div>
    </TabPage>
  );
}
