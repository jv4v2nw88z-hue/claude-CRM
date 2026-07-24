import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import type { ClientListItem } from "../types";
import { formatCurrency, formatRelative, initials } from "../lib/format";
import { TierBadge } from "./TierBadge";
import { Avatar } from "./ui";

/** Mobile presentation of a client row — the desktop view uses a table instead. */
export function ClientCard({ client }: { client: ClientListItem }) {
  return (
    <Link
      to={`/clients/${client.id}`}
      className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-brand-300"
    >
      <div className="flex items-start gap-3">
        <Avatar label={initials(client.businessName)} className="h-9 w-9" />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-medium text-slate-900">{client.businessName}</p>
            <span className="shrink-0 font-semibold tabular-nums text-emerald-600">
              {client.mrr > 0 ? formatCurrency(client.mrr) : "—"}
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <TierBadge tier={client.currentTier} />
            {client.isAtRisk && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                <AlertTriangle className="h-3 w-3" aria-hidden />
                {client.daysSinceLaunch}d, no retainer
              </span>
            )}
          </div>

          <dl className="mt-2 space-y-0.5 text-xs text-slate-500">
            <div className="flex justify-between gap-2">
              <dt>Last contact</dt>
              <dd>{client.lastInteractionAt ? formatRelative(client.lastInteractionAt) : "Never"}</dd>
            </div>
            {client.nextTask && (
              <div className="flex justify-between gap-2">
                <dt>Next up</dt>
                <dd className="truncate text-right text-slate-600">{client.nextTask.title}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </Link>
  );
}
