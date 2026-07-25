import { useState } from "react";
import { Crown, ShieldCheck, UserPlus, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  useClientAccess,
  useGrantClientAccess,
  useRevokeClientAccess,
  useTransferOwnership,
  useUsers,
} from "../hooks/queries";
import { ApiError } from "../api/apiClient";
import { Button, Card, EmptyState, SectionHeading, Skeleton } from "../components/ui";
import { Avatar } from "./ui";
import { initials } from "../lib/format";

/**
 * Who can write to this client.
 *
 * Reads are open to everyone, so this panel is about *writes* — the copy says so
 * explicitly, because "access" in a CRM is usually read access and getting that
 * backwards would be an alarming thing to be wrong about.
 *
 * Shown to everyone but only interactive for the owner and TECHNICAL; the server
 * returns `canManage` so the controls can be hidden rather than offered and then
 * rejected.
 */
export function ManageAccessPanel({ clientId }: { clientId: string }) {
  const { user } = useAuth();
  const accessQuery = useClientAccess(clientId);
  const usersQuery = useUsers();
  const grant = useGrantClientAccess(clientId);
  const revoke = useRevokeClientAccess(clientId);
  const transfer = useTransferOwnership(clientId);
  const [error, setError] = useState<string | null>(null);
  const [pick, setPick] = useState("");

  const access = accessQuery.data;
  const isTechnical = user?.role === "TECHNICAL";

  if (accessQuery.isLoading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-32" />
      </Card>
    );
  }

  const collaboratorIds = new Set(access?.collaborators.map((u) => u.id) ?? []);
  const addable = (usersQuery.data ?? []).filter(
    (u) => u.id !== access?.owner?.id && !collaboratorIds.has(u.id)
  );

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That didn't work.");
    }
  };

  return (
    <Card className="p-5">
      <SectionHeading
        title="Who can edit this client"
        description="Everyone can see this client. Only these people can change it."
      />

      <ul className="list-group">
        {access?.owner && (
          <li className="flex items-center gap-3 p-3">
            <Avatar label={initials(access.owner.name)} className="h-8 w-8" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{access.owner.name}</p>
              <p className="truncate text-xs text-ink/65">{access.owner.email}</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
              <Crown className="h-3 w-3" aria-hidden />
              Owner
            </span>
          </li>
        )}

        {access?.collaborators.map((collab) => (
          <li key={collab.id} className="flex items-center gap-3 p-3">
            <Avatar label={initials(collab.name)} className="h-8 w-8" tone="slate" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{collab.name}</p>
              <p className="truncate text-xs text-ink/65">{collab.email}</p>
            </div>
            {access.canManage && (
              <button
                type="button"
                onClick={() => void run(() => revoke.mutateAsync(collab.id))}
                disabled={revoke.isPending}
                aria-label={`Remove ${collab.name}`}
                className="flex h-11 w-11 items-center justify-center rounded-control text-ink/55 hover:bg-danger/10 hover:text-danger lg:h-8 lg:w-8"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ul>

      {isTechnical && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-ink/65">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          You can edit any client regardless of this list. Each time you do, it's recorded in
          the client's history.
        </p>
      )}

      {access?.canManage && (
        <div className="mt-4 space-y-3 border-t border-separator/60 pt-4">
          {addable.length > 0 ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[12rem] flex-1">
                <label className="label" htmlFor="grant-user">
                  Give edit access to
                </label>
                <select
                  id="grant-user"
                  className="input"
                  value={pick}
                  onChange={(e) => setPick(e.target.value)}
                >
                  <option value="">Choose someone…</option>
                  {addable.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role.toLowerCase()})
                    </option>
                  ))}
                </select>
              </div>
              <Button
                disabled={!pick || grant.isPending}
                loading={grant.isPending}
                onClick={() =>
                  void run(async () => {
                    await grant.mutateAsync(pick);
                    setPick("");
                  })
                }
              >
                <UserPlus className="h-4 w-4" aria-hidden />
                Add
              </Button>
            </div>
          ) : (
            <p className="text-xs text-ink/65">Everyone already has access to this client.</p>
          )}

          {/* Transfer is TECHNICAL-only: it changes who is accountable for the
              account, which isn't something an owner should do unilaterally. */}
          {isTechnical && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[12rem] flex-1">
                <label className="label" htmlFor="transfer-owner">
                  Transfer ownership to
                </label>
                <select
                  id="transfer-owner"
                  className="input"
                  defaultValue=""
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next) void run(() => transfer.mutateAsync(next));
                    e.target.value = "";
                  }}
                >
                  <option value="">Choose a new owner…</option>
                  {(usersQuery.data ?? [])
                    .filter((u) => u.id !== access.owner?.id)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {!access?.canManage && !isTechnical && (
        <EmptyState
          title="Only the owner can change this"
          description="Ask the owner, or Brian, to add you."
        />
      )}

      {error && (
        <p className="mt-3 rounded-control bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </Card>
  );
}
