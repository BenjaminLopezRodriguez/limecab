import { TabPage } from "@/components/limecab/limecab-shell";

/**
 * Trip history is the one tab that will fetch once it stops reading mocks, so
 * it carries the loading/error pair. The other tabs are static and don't.
 */
export default function ActivityLoading() {
  return (
    <TabPage title="Activity">
      <div aria-hidden="true">
        <div className="mb-7 flex gap-2">
          <div className="bg-muted h-11 w-16 animate-pulse rounded-full" />
          <div className="bg-muted h-11 w-16 animate-pulse rounded-full" />
        </div>
        <div className="bg-muted h-6 w-28 animate-pulse rounded" />
        <div className="ring-border mt-3 rounded-2xl px-5 py-6 ring-1">
          <div className="bg-muted h-4 w-2/3 animate-pulse rounded" />
          <div className="bg-muted mt-2 h-3.5 w-1/2 animate-pulse rounded" />
        </div>

        <div className="bg-muted mt-8 h-6 w-16 animate-pulse rounded" />
        <ul className="mt-3 flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="bg-card ring-border flex items-center gap-3 rounded-2xl p-3 ring-1">
              <div className="bg-muted size-16 shrink-0 animate-pulse rounded-xl" />
              <div className="min-w-0 flex-1">
                <div className="bg-muted h-4 w-2/3 animate-pulse rounded" />
                <div className="bg-muted mt-2 h-3.5 w-1/2 animate-pulse rounded" />
                <div className="bg-muted mt-2 h-3.5 w-12 animate-pulse rounded" />
              </div>
              <div className="bg-muted h-11 w-20 shrink-0 animate-pulse rounded-full" />
            </li>
          ))}
        </ul>
      </div>
      <span className="sr-only">Loading your trips</span>
    </TabPage>
  );
}
