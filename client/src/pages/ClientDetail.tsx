import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import clsx from "clsx";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  ExternalLink,
  FileText,
  Mail,
  Phone,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import {
  useChangeTier,
  useClientDetail,
  useCompleteTask,
  useCreateContact,
  useCreateRetainer,
  useCreateTask,
  useDeleteDocument,
  useDeleteRetainer,
  useDocumentConfig,
  useLogInteraction,
  useUpdateClient,
  useUpdateRetainer,
  useUpdateTask,
  useUploadDocument,
  useUsers,
} from "../hooks/queries";
import { documentsApi } from "../api/resources";
import type {
  ClientDetail as ClientDetailType,
  InteractionType,
  RetainerStatus,
  ServiceTierType,
} from "../types";
import {
  ALL_TIERS,
  formatCurrency,
  formatDate,
  initials,
  INTERACTION_LABELS,
  TIER_LABELS,
  toDateInputValue,
} from "../lib/format";
import { ConfirmModal } from "../components/ConfirmModal";
import { InteractionTimelineItem } from "../components/InteractionTimelineItem";
import { SlideOverPanel } from "../components/SlideOverPanel";
import { TaskChecklist } from "../components/TaskChecklist";
import { TierBadge } from "../components/TierBadge";
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorNotice,
  Field,
  SectionHeading,
  Skeleton,
} from "../components/ui";

const TABS = ["Overview", "Tasks", "Interactions", "Retainers", "Documents", "History"] as const;
type Tab = (typeof TABS)[number];

export function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const clientQuery = useClientDetail(id);
  const [tab, setTab] = useState<Tab>("Overview");
  const [panel, setPanel] = useState<"interaction" | "task" | "retainer" | "contact" | null>(null);

  if (clientQuery.isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (clientQuery.isError || !clientQuery.data) {
    return (
      <ErrorNotice
        message={(clientQuery.error as Error)?.message ?? "Client not found"}
        onRetry={() => clientQuery.refetch()}
      />
    );
  }

  const client = clientQuery.data;

  return (
    <div className="space-y-5">
      <Link
        to="/clients"
        className="inline-flex items-center gap-1 text-xs font-medium text-ink/70 hover:text-accent"
      >
        ← Back to clients
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <ClientSidebar client={client} onOpenPanel={setPanel} />

        <div className="min-w-0">
          <div className="mb-4 flex gap-1 overflow-x-auto border-b border-separator/70">
            {TABS.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setTab(name)}
                className={clsx(
                  "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  tab === name
                    ? "border-brand-700 text-accent"
                    : "border-transparent text-ink/70 hover:text-ink"
                )}
              >
                {name}
                {name === "Tasks" && openTaskCount(client) > 0 && (
                  <span className="ml-1.5 rounded-full bg-fill/15 px-1.5 py-0.5 text-xs text-ink/70">
                    {openTaskCount(client)}
                  </span>
                )}
              </button>
            ))}
          </div>

          {tab === "Overview" && <OverviewTab client={client} />}
          {tab === "Tasks" && <TasksTab client={client} onAdd={() => setPanel("task")} />}
          {tab === "Interactions" && (
            <InteractionsTab client={client} onAdd={() => setPanel("interaction")} />
          )}
          {tab === "Retainers" && <RetainersTab client={client} onAdd={() => setPanel("retainer")} />}
          {tab === "Documents" && <DocumentsTab client={client} />}
          {tab === "History" && <HistoryTab client={client} />}
        </div>
      </div>

      <LogInteractionPanel
        open={panel === "interaction"}
        clientId={client.id}
        onClose={() => setPanel(null)}
      />
      <AddTaskPanel open={panel === "task"} clientId={client.id} onClose={() => setPanel(null)} />
      <AddRetainerPanel
        open={panel === "retainer"}
        client={client}
        onClose={() => setPanel(null)}
      />
      <AddContactPanel
        open={panel === "contact"}
        clientId={client.id}
        onClose={() => setPanel(null)}
      />
    </div>
  );
}

function openTaskCount(client: ClientDetailType): number {
  return client.tasks.filter((t) => ["OPEN", "IN_PROGRESS", "SNOOZED"].includes(t.status)).length;
}

// ---------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------

function ClientSidebar({
  client,
  onOpenPanel,
}: {
  client: ClientDetailType;
  onOpenPanel: (panel: "interaction" | "task" | "retainer" | "contact") => void;
}) {
  const [tierModalOpen, setTierModalOpen] = useState(false);
  const [pendingTier, setPendingTier] = useState<ServiceTierType>(client.currentTier);
  const changeTier = useChangeTier(client.id);
  const primaryContact = client.contacts.find((c) => c.isPrimary) ?? client.contacts[0] ?? null;

  useEffect(() => {
    setPendingTier(client.currentTier);
  }, [client.currentTier]);

  const handleTierChange = async () => {
    await changeTier.mutateAsync({ newTier: pendingTier });
    setTierModalOpen(false);
  };

  return (
    <aside className="lg:sticky lg:top-6 lg:self-start">
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <Avatar label={initials(client.businessName)} className="h-11 w-11 text-sm" />
          <div className="min-w-0">
            <h1 className="text-lg font-semibold leading-tight text-ink">
              {client.businessName}
            </h1>
            {client.industry && <p className="text-xs text-ink/70">{client.industry}</p>}
          </div>
        </div>

        {client.websiteUrl && (
          <a
            href={client.websiteUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
          >
            Visit site
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        )}

        <div className="mt-4 border-t border-separator/50 pt-4">
          <p className="label">Current tier</p>
          <TierBadge tier={client.currentTier} size="lg" />
          <Button
            variant="secondary"
            size="sm"
            className="mt-2 w-full"
            onClick={() => setTierModalOpen(true)}
          >
            Change Tier
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>

        <div className="mt-4 border-t border-separator/50 pt-4">
          <p className="label">Current MRR</p>
          <p className="text-2xl font-semibold tabular-nums text-success">
            {formatCurrency(client.mrr)}
          </p>
          {client.mrr === 0 && (
            <p className="mt-0.5 text-xs text-ink/65">No active retainer yet.</p>
          )}
        </div>

        {client.websiteLaunchDate && (
          <div className="mt-4 border-t border-separator/50 pt-4">
            <p className="label">Website launched</p>
            <p className="text-sm text-ink">{formatDate(client.websiteLaunchDate)}</p>
            {client.currentTier === "WEBSITE_LIVE" && client.daysSinceLaunch !== null && (
              <p
                className={clsx(
                  "mt-1 text-xs font-medium",
                  client.isAtRisk ? "text-warning" : "text-ink/70"
                )}
              >
                {client.isAtRisk ? (
                  <>
                    <AlertTriangle className="mr-1 inline h-3 w-3" aria-hidden />
                    Live {client.daysSinceLaunch} days — no retainer yet
                  </>
                ) : (
                  <>Live {client.daysSinceLaunch} days</>
                )}
              </p>
            )}
          </div>
        )}

        {client.accountOwner && (
          <div className="mt-4 border-t border-separator/50 pt-4">
            <p className="label">Account owner</p>
            <div className="flex items-center gap-2">
              <Avatar label={initials(client.accountOwner.name)} className="h-6 w-6" tone="slate" />
              <span className="text-sm text-ink">{client.accountOwner.name}</span>
            </div>
          </div>
        )}

        <div className="mt-4 border-t border-separator/50 pt-4">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="label mb-0">Primary contact</p>
            <button
              type="button"
              onClick={() => onOpenPanel("contact")}
              className="text-xs font-medium text-accent hover:underline"
            >
              Add
            </button>
          </div>

          {primaryContact ? (
            <div className="rounded-lg bg-fill/8 p-3">
              <p className="text-sm font-medium text-ink">
                {primaryContact.firstName} {primaryContact.lastName}
              </p>
              {primaryContact.title && (
                <p className="text-xs text-ink/70">{primaryContact.title}</p>
              )}
              <div className="mt-2 space-y-1">
                {primaryContact.phone && (
                  <a
                    href={`tel:${primaryContact.phone}`}
                    className="flex items-center gap-1.5 text-xs text-accent hover:underline"
                  >
                    <Phone className="h-3 w-3" aria-hidden />
                    {primaryContact.phone}
                  </a>
                )}
                {primaryContact.email && (
                  <a
                    href={`mailto:${primaryContact.email}`}
                    className="flex items-center gap-1.5 break-all text-xs text-accent hover:underline"
                  >
                    <Mail className="h-3 w-3 shrink-0" aria-hidden />
                    {primaryContact.email}
                  </a>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-ink/65">No contact on file.</p>
          )}
        </div>

        <div className="mt-4 space-y-2 border-t border-separator/50 pt-4">
          <Button className="w-full" onClick={() => onOpenPanel("interaction")}>
            Log Interaction
          </Button>
          <Button variant="secondary" className="w-full" onClick={() => onOpenPanel("task")}>
            Add Task
          </Button>
        </div>
      </Card>

      <ConfirmModal
        open={tierModalOpen}
        title="Change service tier"
        tone="warning"
        confirmLabel="Change tier"
        loading={changeTier.isPending}
        confirmDisabled={pendingTier === client.currentTier}
        onConfirm={handleTierChange}
        onCancel={() => {
          setPendingTier(client.currentTier);
          setTierModalOpen(false);
        }}
        body={
          <div className="space-y-3">
            <p>
              Moving {client.businessName} out of{" "}
              <strong>{TIER_LABELS[client.currentTier]}</strong> restarts its automation timers and
              cancels any open upsell reminders tied to the old tier.
            </p>

            <div>
              <label className="label" htmlFor="new-tier">
                New tier
              </label>
              <select
                id="new-tier"
                className="input"
                value={pendingTier}
                onChange={(e) => setPendingTier(e.target.value as ServiceTierType)}
              >
                {ALL_TIERS.map((tier) => (
                  <option key={tier} value={tier}>
                    {TIER_LABELS[tier]}
                  </option>
                ))}
              </select>
            </div>

            {pendingTier === "WEBSITE_LIVE" && !client.websiteLaunchDate && (
              <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
                Today will be recorded as the website launch date, starting the upsell countdown.
              </p>
            )}
          </div>
        }
      />
    </aside>
  );
}

// ---------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------

function OverviewTab({ client }: { client: ClientDetailType }) {
  const [notes, setNotes] = useState(client.notes ?? "");
  const [saved, setSaved] = useState(false);
  const updateClient = useUpdateClient(client.id);

  useEffect(() => {
    setNotes(client.notes ?? "");
  }, [client.notes]);

  const handleSaveNotes = async () => {
    await updateClient.mutateAsync({ notes });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <SectionHeading
          title="Notes"
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={handleSaveNotes}
              loading={updateClient.isPending}
              disabled={notes === (client.notes ?? "")}
            >
              {saved ? "Saved" : "Save"}
            </Button>
          }
        />
        <textarea
          className="input min-h-[8rem]"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What matters about this client — who decides, what they care about, what they've said no to."
        />
      </Card>

      <Card className="p-5">
        <SectionHeading title="Details" />
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Detail label="Industry" value={client.industry} />
          <Detail label="Website" value={client.websiteUrl} />
          <Detail label="Website launched" value={formatDate(client.websiteLaunchDate)} />
          <Detail label="Client since" value={formatDate(client.createdAt)} />
          <Detail label="Address" value={client.address} />
          <Detail
            label="City / State"
            value={[client.city, client.state].filter(Boolean).join(", ") || null}
          />
          <Detail label="ZIP" value={client.zip} />
          <Detail label="Account owner" value={client.accountOwner?.name ?? null} />
        </dl>
      </Card>

      {client.contacts.length > 0 && (
        <Card className="p-5">
          <SectionHeading title="Contacts" />
          <ul className="divide-y divide-separator/50">
            {client.contacts.map((contact) => (
              <li key={contact.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">
                    {contact.firstName} {contact.lastName}
                    {contact.isPrimary && (
                      <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-accent">
                        Primary
                      </span>
                    )}
                  </p>
                  {contact.title && <p className="text-xs text-ink/70">{contact.title}</p>}
                </div>
                <div className="shrink-0 text-right text-xs">
                  {contact.phone && (
                    <a href={`tel:${contact.phone}`} className="block text-accent hover:underline">
                      {contact.phone}
                    </a>
                  )}
                  {contact.email && (
                    <a
                      href={`mailto:${contact.email}`}
                      className="block break-all text-accent hover:underline"
                    >
                      {contact.email}
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-ink/70">{label}</dt>
      <dd className="mt-0.5 break-words text-ink">{value || "—"}</dd>
    </div>
  );
}

function TasksTab({ client, onAdd }: { client: ClientDetailType; onAdd: () => void }) {
  const completeTask = useCompleteTask();
  const updateTask = useUpdateTask();
  const [showCompleted, setShowCompleted] = useState(false);

  const tasks = client.tasks.filter((t) =>
    showCompleted ? true : ["OPEN", "IN_PROGRESS", "SNOOZED"].includes(t.status)
  );

  const handleSnooze = (taskId: string) => {
    const snoozedUntil = new Date();
    snoozedUntil.setDate(snoozedUntil.getDate() + 7);
    updateTask.mutate({ id: taskId, data: { snoozedUntil: snoozedUntil.toISOString() } });
  };

  return (
    <Card className="p-5">
      <SectionHeading
        title="Tasks"
        action={
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-ink/70">
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={(e) => setShowCompleted(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-separator text-accent"
              />
              Show closed
            </label>
            <Button size="sm" onClick={onAdd}>
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Task
            </Button>
          </div>
        }
      />
      <TaskChecklist
        tasks={tasks}
        onComplete={(id) => completeTask.mutate(id)}
        onSnooze={handleSnooze}
        showClient={false}
        emptyTitle="No open tasks"
        emptyDescription={`Nothing outstanding for ${client.businessName}.`}
      />
    </Card>
  );
}

function InteractionsTab({ client, onAdd }: { client: ClientDetailType; onAdd: () => void }) {
  return (
    <Card className="p-5">
      <SectionHeading
        title="Interactions"
        description="Every call, email and meeting on record."
        action={
          <Button size="sm" onClick={onAdd}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Log
          </Button>
        }
      />

      {client.interactions.length === 0 ? (
        <EmptyState
          title="Nothing logged yet"
          description="Log the next call so the whole history lives in one place."
          action={<Button size="sm" onClick={onAdd}>Log interaction</Button>}
        />
      ) : (
        <ul>
          {client.interactions.map((interaction, index) => (
            <InteractionTimelineItem
              key={interaction.id}
              type={interaction.type}
              summary={interaction.summary}
              occurredAt={interaction.occurredAt}
              loggedBy={interaction.loggedBy?.name}
              isLast={index === client.interactions.length - 1}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

const RETAINER_STATUS_STYLES: Record<RetainerStatus, string> = {
  ACTIVE: "bg-success/15 text-success",
  PAUSED: "bg-warning/15 text-warning",
  CANCELLED: "bg-danger/15 text-danger",
  PENDING_FIRST_PAYMENT: "bg-fill/15 text-ink/70",
};

const RETAINER_STATUS_LABELS: Record<RetainerStatus, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  CANCELLED: "Cancelled",
  PENDING_FIRST_PAYMENT: "Pending first payment",
};

function RetainersTab({ client, onAdd }: { client: ClientDetailType; onAdd: () => void }) {
  const updateRetainer = useUpdateRetainer();
  const deleteRetainer = useDeleteRetainer();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  return (
    <Card className="p-5">
      <SectionHeading
        title="Retainers"
        description="Only ACTIVE retainers count toward MRR."
        action={
          <Button size="sm" onClick={onAdd}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Retainer
          </Button>
        }
      />

      {client.retainers.length === 0 ? (
        <EmptyState
          title="No retainers yet"
          description="This is the whole game — a website build becomes a business when it turns into a monthly retainer."
          action={<Button size="sm" onClick={onAdd}>Add retainer</Button>}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-separator/70 text-xs uppercase tracking-wide text-ink/70">
              <tr>
                <th scope="col" className="py-2 pr-3 font-medium">Tier</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Monthly</th>
                <th scope="col" className="py-2 pr-3 font-medium">Status</th>
                <th scope="col" className="py-2 pr-3 font-medium">Start</th>
                <th scope="col" className="py-2 pr-3 font-medium">End</th>
                <th scope="col" className="py-2 font-medium"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-separator/50">
              {client.retainers.map((retainer) => (
                <tr key={retainer.id}>
                  <td className="py-2.5 pr-3">
                    <TierBadge tier={retainer.tier} />
                  </td>
                  <td className="py-2.5 pr-3 text-right font-medium tabular-nums text-ink">
                    {formatCurrency(retainer.monthlyAmount)}
                  </td>
                  <td className="py-2.5 pr-3">
                    <select
                      className={clsx(
                        "cursor-pointer rounded-full border-0 px-2 py-1 text-xs font-medium",
                        RETAINER_STATUS_STYLES[retainer.status]
                      )}
                      value={retainer.status}
                      onChange={(e) =>
                        updateRetainer.mutate({
                          id: retainer.id,
                          data: { status: e.target.value },
                        })
                      }
                      aria-label={`Status for ${TIER_LABELS[retainer.tier]} retainer`}
                    >
                      {(Object.keys(RETAINER_STATUS_LABELS) as RetainerStatus[]).map((status) => (
                        <option key={status} value={status}>
                          {RETAINER_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2.5 pr-3 text-ink/70">{formatDate(retainer.startDate)}</td>
                  <td className="py-2.5 pr-3 text-ink/70">{formatDate(retainer.endDate)}</td>
                  <td className="py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(retainer.id)}
                      className="rounded p-1 text-ink/55 hover:bg-danger/10 hover:text-danger"
                      aria-label="Delete retainer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        open={confirmDelete !== null}
        title="Delete this retainer?"
        tone="danger"
        confirmLabel="Delete"
        loading={deleteRetainer.isPending}
        body="This removes it from MRR history entirely. If the client simply stopped paying, set the status to Cancelled instead so the revenue history stays accurate."
        onConfirm={async () => {
          if (confirmDelete) await deleteRetainer.mutateAsync(confirmDelete);
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </Card>
  );
}

function DocumentsTab({ client }: { client: ClientDetailType }) {
  const { data: config } = useDocumentConfig();
  const uploadDocument = useUploadDocument(client.id);
  const deleteDocument = useDeleteDocument();
  const [category, setCategory] = useState("contract");
  const [error, setError] = useState<string | null>(null);

  const storageEnabled = config?.storageEnabled ?? false;

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      await uploadDocument.mutateAsync({ file, category });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const handleDownload = async (documentId: string) => {
    const { url } = await documentsApi.downloadUrl(documentId);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Card className="p-5">
      <SectionHeading title="Documents" description="Contracts, invoices, brand assets." />

      {!storageEnabled ? (
        <div className="rounded-lg border border-separator/70 bg-fill/8 p-4 text-sm text-ink/70">
          File storage isn't configured on this server yet. Set <code>S3_BUCKET</code>,{" "}
          <code>S3_ACCESS_KEY</code> and <code>S3_SECRET_KEY</code> to enable uploads.
        </div>
      ) : (
        <div className="mb-4 flex flex-wrap items-end gap-2">
          <Field label="Category" htmlFor="doc-category" className="w-40">
            <select
              id="doc-category"
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="contract">Contract</option>
              <option value="invoice">Invoice</option>
              <option value="brand asset">Brand asset</option>
              <option value="screenshot">Screenshot</option>
              <option value="other">Other</option>
            </select>
          </Field>

          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-800">
            <Upload className="h-4 w-4" aria-hidden />
            {uploadDocument.isPending ? "Uploading…" : "Upload file"}
            <input
              type="file"
              className="sr-only"
              disabled={uploadDocument.isPending}
              onChange={(e) => {
                void handleFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      )}

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      {client.documents.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="No documents yet"
          description="Signed contracts and invoices live here so they're not buried in email."
        />
      ) : (
        <ul className="divide-y divide-separator/50">
          {client.documents.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <FileText className="h-4 w-4 shrink-0 text-ink/65" aria-hidden />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{doc.fileName}</p>
                  <p className="text-xs text-ink/70">
                    {doc.category ? `${doc.category} · ` : ""}
                    {formatDate(doc.uploadedAt)}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => void handleDownload(doc.id)}>
                  Download
                </Button>
                <button
                  type="button"
                  onClick={() => deleteDocument.mutate(doc.id)}
                  className="rounded p-1 text-ink/55 hover:bg-danger/10 hover:text-danger"
                  aria-label={`Delete ${doc.fileName}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function HistoryTab({ client }: { client: ClientDetailType }) {
  return (
    <Card className="p-5">
      <SectionHeading
        title="Service ladder history"
        description="Every tier change, and who made it."
      />

      {client.serviceHistory.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-8 w-8" />}
          title="No tier changes recorded"
          description="Changing this client's tier will start the audit trail."
        />
      ) : (
        <ol className="space-y-0">
          {client.serviceHistory.map((entry, index) => (
            <li key={entry.id} className="relative flex gap-3 pb-4 last:pb-0">
              {index !== client.serviceHistory.length - 1 && (
                <span className="absolute left-[7px] top-4 h-full w-px bg-fill/25" aria-hidden />
              )}
              <span className="relative z-10 mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-brand-500 bg-content" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink">
                  {entry.fromTier ? (
                    <>
                      Moved from <strong>{TIER_LABELS[entry.fromTier]}</strong> to{" "}
                      <strong>{TIER_LABELS[entry.toTier]}</strong>
                    </>
                  ) : (
                    <>
                      Started at <strong>{TIER_LABELS[entry.toTier]}</strong>
                    </>
                  )}
                </p>
                <p className="text-xs text-ink/70">
                  {formatDate(entry.changedAt)}
                  {entry.changedBy && ` · ${entry.changedBy.name}`}
                </p>
                {entry.note && <p className="mt-1 text-xs italic text-ink/70">{entry.note}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------
// Slide-over forms
// ---------------------------------------------------------------

function LogInteractionPanel({
  open,
  clientId,
  onClose,
}: {
  open: boolean;
  clientId: string;
  onClose: () => void;
}) {
  const [type, setType] = useState<InteractionType>("CALL");
  const [summary, setSummary] = useState("");
  const [occurredAt, setOccurredAt] = useState(toDateInputValue(new Date()));
  const [error, setError] = useState<string | null>(null);
  const logInteraction = useLogInteraction(clientId);

  useEffect(() => {
    if (open) {
      setType("CALL");
      setSummary("");
      setOccurredAt(toDateInputValue(new Date()));
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await logInteraction.mutateAsync({
        type,
        summary: summary.trim(),
        occurredAt: occurredAt ? new Date(occurredAt).toISOString() : null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log the interaction");
    }
  };

  return (
    <SlideOverPanel
      open={open}
      onClose={onClose}
      title="Log interaction"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="interaction-form"
            loading={logInteraction.isPending}
            disabled={summary.trim().length === 0}
          >
            Log it
          </Button>
        </div>
      }
    >
      <form id="interaction-form" onSubmit={handleSubmit} className="space-y-4">
        <Field label="Type" htmlFor="interaction-type">
          <select
            id="interaction-type"
            className="input"
            value={type}
            onChange={(e) => setType(e.target.value as InteractionType)}
          >
            {(Object.keys(INTERACTION_LABELS) as InteractionType[]).map((option) => (
              <option key={option} value={option}>
                {INTERACTION_LABELS[option]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="When" htmlFor="interaction-date">
          <input
            id="interaction-date"
            type="date"
            className="input"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
          />
        </Field>

        <Field label="Summary" htmlFor="interaction-summary">
          <textarea
            id="interaction-summary"
            className="input min-h-[8rem]"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="What was said, what they want, what you promised."
            autoFocus
          />
        </Field>

        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </SlideOverPanel>
  );
}

function AddTaskPanel({
  open,
  clientId,
  onClose,
}: {
  open: boolean;
  clientId: string;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { data: users = [] } = useUsers();
  const createTask = useCreateTask();

  useEffect(() => {
    if (open) {
      setTitle("");
      setAssignedToId("");
      setDueDate("");
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await createTask.mutateAsync({
        title: title.trim(),
        clientId,
        assignedToId: assignedToId || null,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the task");
    }
  };

  return (
    <SlideOverPanel
      open={open}
      onClose={onClose}
      title="Add task"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="task-form"
            loading={createTask.isPending}
            disabled={title.trim().length === 0}
          >
            Add task
          </Button>
        </div>
      }
    >
      <form id="task-form" onSubmit={handleSubmit} className="space-y-4">
        <Field label="Title" htmlFor="task-title">
          <input
            id="task-title"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </Field>

        <Field label="Assign to" htmlFor="task-assignee">
          <select
            id="task-assignee"
            className="input"
            value={assignedToId}
            onChange={(e) => setAssignedToId(e.target.value)}
          >
            <option value="">Unassigned</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Due date" htmlFor="task-due">
          <input
            id="task-due"
            type="date"
            className="input"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </Field>

        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </SlideOverPanel>
  );
}

function AddRetainerPanel({
  open,
  client,
  onClose,
}: {
  open: boolean;
  client: ClientDetailType;
  onClose: () => void;
}) {
  const [tier, setTier] = useState<ServiceTierType>(client.currentTier);
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [status, setStatus] = useState<RetainerStatus>("ACTIVE");
  const [startDate, setStartDate] = useState(toDateInputValue(new Date()));
  const [endDate, setEndDate] = useState("");
  const [billingDay, setBillingDay] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const createRetainer = useCreateRetainer(client.id);

  useEffect(() => {
    if (open) {
      setTier(client.currentTier);
      setMonthlyAmount("");
      setStatus("ACTIVE");
      setStartDate(toDateInputValue(new Date()));
      setEndDate("");
      setBillingDay("1");
      setError(null);
    }
  }, [open, client.currentTier]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await createRetainer.mutateAsync({
        tier,
        monthlyAmount: Number(monthlyAmount),
        status,
        startDate: startDate ? new Date(startDate).toISOString() : null,
        endDate: endDate ? new Date(endDate).toISOString() : null,
        billingDay: billingDay ? Number(billingDay) : null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the retainer");
    }
  };

  const amount = Number(monthlyAmount);
  const outsideTargetBand = amount > 0 && (amount < 500 || amount > 1000);

  return (
    <SlideOverPanel
      open={open}
      onClose={onClose}
      title="Add retainer"
      description={`Recurring revenue for ${client.businessName}.`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="retainer-form"
            loading={createRetainer.isPending}
            disabled={!(amount > 0)}
          >
            Add retainer
          </Button>
        </div>
      }
    >
      <form id="retainer-form" onSubmit={handleSubmit} className="space-y-4">
        <Field label="Service tier" htmlFor="retainer-tier">
          <select
            id="retainer-tier"
            className="input"
            value={tier}
            onChange={(e) => setTier(e.target.value as ServiceTierType)}
          >
            {ALL_TIERS.map((option) => (
              <option key={option} value={option}>
                {TIER_LABELS[option]}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Monthly amount"
          htmlFor="retainer-amount"
          hint={outsideTargetBand ? undefined : "Target band is $500–$1,000/month."}
          error={outsideTargetBand ? "Outside the usual $500–$1,000 band — double-check." : null}
        >
          <input
            id="retainer-amount"
            type="number"
            min="0"
            step="25"
            className="input"
            value={monthlyAmount}
            onChange={(e) => setMonthlyAmount(e.target.value)}
            autoFocus
          />
        </Field>

        <Field
          label="Status"
          htmlFor="retainer-status"
          hint="Only Active retainers count toward MRR."
        >
          <select
            id="retainer-status"
            className="input"
            value={status}
            onChange={(e) => setStatus(e.target.value as RetainerStatus)}
          >
            {(Object.keys(RETAINER_STATUS_LABELS) as RetainerStatus[]).map((option) => (
              <option key={option} value={option}>
                {RETAINER_STATUS_LABELS[option]}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date" htmlFor="retainer-start">
            <input
              id="retainer-start"
              type="date"
              className="input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <Field label="End date" htmlFor="retainer-end" hint="Optional">
            <input
              id="retainer-end"
              type="date"
              className="input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Billing day" htmlFor="retainer-billing" hint="Day of month, 1–28">
          <input
            id="retainer-billing"
            type="number"
            min="1"
            max="28"
            className="input"
            value={billingDay}
            onChange={(e) => setBillingDay(e.target.value)}
          />
        </Field>

        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </SlideOverPanel>
  );
}

function AddContactPanel({
  open,
  clientId,
  onClose,
}: {
  open: boolean;
  clientId: string;
  onClose: () => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isPrimary, setIsPrimary] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const createContact = useCreateContact(clientId);

  useEffect(() => {
    if (open) {
      setFirstName("");
      setLastName("");
      setTitle("");
      setEmail("");
      setPhone("");
      setIsPrimary(true);
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await createContact.mutateAsync({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        title: title.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        isPrimary,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the contact");
    }
  };

  return (
    <SlideOverPanel
      open={open}
      onClose={onClose}
      title="Add contact"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="contact-form"
            loading={createContact.isPending}
            disabled={firstName.trim().length === 0 || lastName.trim().length === 0}
          >
            Add contact
          </Button>
        </div>
      }
    >
      <form id="contact-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" htmlFor="contact-first">
            <input
              id="contact-first"
              className="input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Last name" htmlFor="contact-last">
            <input
              id="contact-last"
              className="input"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Title" htmlFor="contact-title" hint="Owner, Manager…">
          <input
            id="contact-title"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>

        <Field label="Email" htmlFor="contact-email">
          <input
            id="contact-email"
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <Field label="Phone" htmlFor="contact-phone">
          <input
            id="contact-phone"
            type="tel"
            className="input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>

        <label className="flex items-center gap-2 text-sm text-ink/80">
          <input
            type="checkbox"
            checked={isPrimary}
            onChange={(e) => setIsPrimary(e.target.checked)}
            className="h-4 w-4 rounded border-separator text-accent"
          />
          Primary contact
        </label>

        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </SlideOverPanel>
  );
}
