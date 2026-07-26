import { ArrowRight } from "lucide-react";
import { useDealStageHistory } from "../hooks/queries";
import { formatDate, formatRelative } from "../lib/format";
import { Skeleton } from "./ui";

/**
 * Every stage this deal has been through, newest first.
 *
 * Renders the snapshotted names rather than looking the stage up by id — that is
 * the whole reason they are stored. A stage renamed last week must not rewrite
 * what the timeline says happened last month.
 */
export function DealStageHistory({ dealId }: { dealId: string }) {
  const historyQuery = useDealStageHistory(dealId);

  if (historyQuery.isLoading) return <Skeleton className="h-20" />;

  const entries = historyQuery.data?.entries ?? [];
  if (entries.length === 0) {
    return <p className="text-xs text-ink/65">No stage changes recorded yet.</p>;
  }

  return (
    <ol className="space-y-2">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-baseline gap-2 text-xs">
          <span className="flex items-center gap-1 font-medium text-ink">
            {entry.fromStageName && (
              <>
                <span className="text-ink/65">{entry.fromStageName}</span>
                <ArrowRight className="h-3 w-3 text-ink/45" aria-hidden />
              </>
            )}
            {entry.toStageName}
          </span>
          <span className="text-ink/60" title={formatDate(entry.changedAt)}>
            {formatRelative(entry.changedAt)}
            {entry.changedBy ? ` · ${entry.changedBy.name}` : ""}
          </span>
        </li>
      ))}
    </ol>
  );
}
