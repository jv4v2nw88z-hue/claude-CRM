import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { AlertTriangle, Building2, Plus, Search } from "lucide-react";
import {
  useClients,
  useCreateClient,
  useUsers,
} from "../hooks/queries";
import type { ServiceTierType } from "../types";
import { ALL_TIERS, formatCurrency, formatRelative, initials, TIER_LABELS } from "../lib/format";
import { ClientCard } from "../components/ClientCard";
import { SlideOverPanel } from "../components/SlideOverPanel";
import { TierBadge } from "../components/TierBadge";
import { Avatar, Button, Card, EmptyState, ErrorNotice, Field, Skeleton } from "../components/ui";

export function ClientsList() {
  const [search, setSearch] = useState("");
  const [tiers, setTiers] = useState<ServiceTierType[]>([]);
  const [atRiskOnly, setAtRiskOnly] = useState(false);
  const [creating, setCreating] = useState(false);

  const filters = useMemo(
    () => ({
      search: search.trim() || undefined,
      tier: tiers.length > 0 ? tiers.join(",") : undefined,
      atRisk: atRiskOnly || undefined,
    }),
    [search, tiers, atRiskOnly]
  );

  const clientsQuery = useClients(filters);
  const clients = clientsQuery.data ?? [];

  const toggleTier = (tier: ServiceTierType) => {
    setTiers((current) =>
      current.includes(tier) ? current.filter((t) => t !== tier) : [...current, tier]
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Clients</h1>
          <p className="text-sm text-slate-500">
            {clients.length} {clients.length === 1 ? "client" : "clients"}
            {clients.length > 0 && (
              <> · {formatCurrency(clients.reduce((sum, c) => sum + c.mrr, 0))} MRR</>
            )}
          </p>
        </div>

        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          New Client
        </Button>
      </div>

      {/* Filter bar */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              type="search"
              className="input pl-9"
              placeholder="Search clients…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search clients"
            />
          </div>

          <button
            type="button"
            onClick={() => setAtRiskOnly((v) => !v)}
            className={clsx(
              "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors lg:min-h-0",
              atRiskOnly
                ? "border-amber-300 bg-amber-100 text-amber-900"
                : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            )}
            aria-pressed={atRiskOnly}
          >
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            At risk only
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <FilterPill active={tiers.length === 0} onClick={() => setTiers([])}>
            All
          </FilterPill>
          {ALL_TIERS.map((tier) => (
            <FilterPill key={tier} active={tiers.includes(tier)} onClick={() => toggleTier(tier)}>
              {TIER_LABELS[tier]}
            </FilterPill>
          ))}
        </div>
      </div>

      {clientsQuery.isError && (
        <ErrorNotice
          message={(clientsQuery.error as Error).message}
          onRetry={() => clientsQuery.refetch()}
        />
      )}

      {clientsQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-8 w-8" />}
          title={
            search || tiers.length > 0 || atRiskOnly
              ? "No clients match these filters"
              : "No clients yet"
          }
          description={
            search || tiers.length > 0 || atRiskOnly
              ? "Try clearing a filter or two."
              : "Add your first client, or convert a won deal from the pipeline."
          }
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              New Client
            </Button>
          }
        />
      ) : (
        <>
          {/* Mobile: stacked cards. Desktop: a scannable table. */}
          <div className="space-y-2 lg:hidden">
            {clients.map((client) => (
              <ClientCard key={client.id} client={client} />
            ))}
          </div>

          <Card className="hidden overflow-hidden lg:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Business</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Tier</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">MRR</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Owner</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Last contact</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Next task</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link to={`/clients/${client.id}`} className="flex items-center gap-2.5 group">
                        <Avatar label={initials(client.businessName)} className="h-7 w-7" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-slate-900 group-hover:text-brand-700">
                            {client.businessName}
                          </span>
                          {client.industry && (
                            <span className="block truncate text-xs text-slate-400">
                              {client.industry}
                            </span>
                          )}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <TierBadge tier={client.currentTier} />
                        {client.isAtRisk && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                            title={`Live ${client.daysSinceLaunch} days with no active retainer`}
                          >
                            <AlertTriangle className="h-3 w-3" aria-hidden />
                            {client.daysSinceLaunch}d
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {client.mrr > 0 ? (
                        <span className="text-emerald-600">{formatCurrency(client.mrr)}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {client.accountOwner?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {client.lastInteractionAt ? formatRelative(client.lastInteractionAt) : "Never"}
                    </td>
                    <td className="max-w-[16rem] px-4 py-3">
                      {client.nextTask ? (
                        <span className="block truncate text-slate-600" title={client.nextTask.title}>
                          {client.nextTask.title}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      <NewClientPanel open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        // 36px on touch keeps the tier pills comfortably tappable without making
        // the desktop filter row feel oversized.
        "inline-flex min-h-9 items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors lg:min-h-0",
        active
          ? "border-brand-700 bg-brand-700 text-white"
          : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
      )}
    >
      {children}
    </button>
  );
}

/** Minimal required fields — the rest gets filled in on the detail page. */
function NewClientPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("");
  const [currentTier, setCurrentTier] = useState<ServiceTierType>("PROSPECT");
  const [accountOwnerId, setAccountOwnerId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: users = [] } = useUsers();
  const createClient = useCreateClient();

  const reset = () => {
    setBusinessName("");
    setIndustry("");
    setCurrentTier("PROSPECT");
    setAccountOwnerId("");
    setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await createClient.mutateAsync({
        businessName: businessName.trim(),
        industry: industry.trim() || null,
        currentTier,
        accountOwnerId: accountOwnerId || null,
      });
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the client");
    }
  };

  return (
    <SlideOverPanel
      open={open}
      onClose={onClose}
      title="New client"
      description="Just the essentials — you can fill in the rest on the client page."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            form="new-client-form"
            type="submit"
            loading={createClient.isPending}
            disabled={businessName.trim().length === 0}
          >
            Create client
          </Button>
        </div>
      }
    >
      <form id="new-client-form" onSubmit={handleSubmit} className="space-y-4">
        <Field label="Business name" htmlFor="businessName">
          <input
            id="businessName"
            className="input"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            required
            autoFocus
          />
        </Field>

        <Field label="Industry" htmlFor="industry" hint="e.g. Restaurant, Retail, Dental">
          <input
            id="industry"
            className="input"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
          />
        </Field>

        <Field
          label="Current tier"
          htmlFor="tier"
          hint="Starting at Website Live starts the upsell timer today."
        >
          <select
            id="tier"
            className="input"
            value={currentTier}
            onChange={(e) => setCurrentTier(e.target.value as ServiceTierType)}
          >
            {ALL_TIERS.map((tier) => (
              <option key={tier} value={tier}>
                {TIER_LABELS[tier]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Account owner" htmlFor="owner">
          <select
            id="owner"
            className="input"
            value={accountOwnerId}
            onChange={(e) => setAccountOwnerId(e.target.value)}
          >
            <option value="">Unassigned</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </Field>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </SlideOverPanel>
  );
}
