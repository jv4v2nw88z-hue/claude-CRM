import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import type { DashboardSummary } from "../types";
import { PitchNowModal } from "./PitchNowModal";
import { Skeleton } from "./ui";

interface AtRiskPanelProps {
  atRisk: DashboardSummary["atRiskClients"] | undefined;
  isLoading?: boolean;
}

/**
 * The single most important widget in the app. A client sitting at WEBSITE_LIVE
 * with no retainer is money already earned and not collected, so this panel is
 * loud on purpose and sits above everything except the headline numbers.
 */
export function AtRiskPanel({ atRisk, isLoading }: AtRiskPanelProps) {
  const [pitching, setPitching] = useState<{ clientId: string; businessName: string } | null>(null);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="mt-3 h-14 w-full" />
      </div>
    );
  }

  const clients = atRisk ?? [];

  if (clients.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
        <p className="text-sm font-medium text-emerald-800">
          No at-risk clients right now — every launched site has an active retainer or a pitch in
          motion. Nice work.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-900">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          At-Risk Clients — Website Live, No Retainer Yet
          <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs text-amber-900">
            {clients.length}
          </span>
        </h3>

        <ul className="space-y-2">
          {clients.map((client) => (
            <li
              key={client.clientId}
              className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-white p-3
                         sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <Link
                  to={`/clients/${client.clientId}`}
                  className="font-medium text-slate-900 hover:text-brand-700 hover:underline"
                >
                  {client.businessName}
                </Link>
                <p className="text-xs text-slate-500">
                  Live for {client.daysSinceLaunch} days — no active retainer
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setPitching({ clientId: client.clientId, businessName: client.businessName })
                }
                className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white
                           hover:bg-amber-700"
              >
                Pitch Now
              </button>
            </li>
          ))}
        </ul>
      </div>

      <PitchNowModal
        open={pitching !== null}
        clientId={pitching?.clientId ?? null}
        businessName={pitching?.businessName ?? ""}
        onClose={() => setPitching(null)}
      />
    </>
  );
}
