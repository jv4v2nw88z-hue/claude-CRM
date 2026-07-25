import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Plus, Trash2 } from "lucide-react";
import {
  useConvertDeal,
  useCreateDeal,
  useDeals,
  useDeleteDeal,
  useUpdateDeal,
} from "../hooks/queries";
import type { Deal, DealStage } from "../types";
import { formatCurrency } from "../lib/format";
import { ConfirmModal } from "../components/ConfirmModal";
import { DealCard } from "../components/DealCard";
import { DealKanbanColumn } from "../components/DealKanbanColumn";
import { SlideOverPanel } from "../components/SlideOverPanel";
import { Button, ErrorNotice, Field, Skeleton } from "../components/ui";

const STAGES: DealStage[] = ["New", "Contacted", "Quoted", "Won", "Lost"];

export function Deals() {
  const dealsQuery = useDeals();
  const updateDeal = useUpdateDeal();
  const convertDeal = useConvertDeal();
  const navigate = useNavigate();

  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);
  const [converting, setConverting] = useState<Deal | null>(null);

  // A little travel before a drag starts, so tapping a card on mobile still opens it.
  // KeyboardSensor makes the board operable without a pointer at all: focus a
  // grip, Space to lift, arrows to move, Space to drop.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );

  const dealsByStage = useMemo(() => {
    const map = new Map<DealStage, Deal[]>(STAGES.map((s) => [s, []]));
    for (const deal of dealsQuery.data ?? []) {
      const bucket = map.get(deal.stage) ?? map.get("New")!;
      bucket.push(deal);
    }
    return map;
  }, [dealsQuery.data]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDeal((event.active.data.current as { deal: Deal } | undefined)?.deal ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDeal(null);
    const { active, over } = event;
    if (!over) return;

    const deal = (active.data.current as { deal: Deal } | undefined)?.deal;
    const newStage = over.id as DealStage;
    if (!deal || deal.stage === newStage) return;

    // Landing in Won is the moment a prospect becomes a client — confirm, don't assume.
    if (newStage === "Won" && !deal.clientId) {
      setConverting({ ...deal, stage: newStage });
      return;
    }

    updateDeal.mutate({ id: deal.id, data: { stage: newStage } });
  };

  const handleConvert = async () => {
    if (!converting) return;
    const client = await convertDeal.mutateAsync({ id: converting.id, data: {} });
    setConverting(null);
    navigate(`/clients/${client.id}`);
  };

  const handleConvertCancel = async () => {
    // They still dragged it to Won — record the stage, just don't create a client.
    if (converting) {
      await updateDeal.mutateAsync({ id: converting.id, data: { stage: "Won" } });
    }
    setConverting(null);
  };

  const pipelineValue = (dealsQuery.data ?? [])
    .filter((d) => d.stage !== "Won" && d.stage !== "Lost")
    .reduce((sum, d) => sum + (d.estimatedValue ?? 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Deals</h1>
          <p className="text-sm text-ink/70">
            {formatCurrency(pipelineValue)} in open pipeline
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          New Deal
        </Button>
      </div>

      {dealsQuery.isError && (
        <ErrorNotice
          message={(dealsQuery.error as Error).message}
          onRetry={() => dealsQuery.refetch()}
        />
      )}

      {dealsQuery.isLoading ? (
        <div className="flex gap-4 overflow-x-auto">
          {STAGES.map((stage) => (
            <Skeleton key={stage} className="h-64 w-72 shrink-0" />
          ))}
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STAGES.map((stage) => (
              <DealKanbanColumn
                key={stage}
                stage={stage}
                deals={dealsByStage.get(stage) ?? []}
                onOpenDeal={setEditing}
              />
            ))}
          </div>

          <DragOverlay>
            {activeDeal && <DealCard deal={activeDeal} onOpen={() => undefined} isOverlay />}
          </DragOverlay>
        </DndContext>
      )}

      <DealPanel
        // Remounting on a different deal resets the form to that deal's values.
        key={editing?.id ?? "new"}
        open={creating || editing !== null}
        deal={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />

      <ConfirmModal
        open={converting !== null}
        title="Convert to client?"
        tone="primary"
        confirmLabel="Convert to client"
        cancelLabel="Just mark it Won"
        loading={convertDeal.isPending}
        onConfirm={handleConvert}
        onCancel={handleConvertCancel}
        body={
          <p>
            This creates a client record for <strong>{converting?.businessName}</strong> at the
            Website Build tier, carries over the contact details, and opens the new client page.
          </p>
        }
      />
    </div>
  );
}

function DealPanel({
  open,
  deal,
  onClose,
}: {
  open: boolean;
  deal: Deal | null;
  onClose: () => void;
}) {
  const isEdit = deal !== null;
  const createDeal = useCreateDeal();
  const updateDeal = useUpdateDeal();
  const deleteDeal = useDeleteDeal();
  const convertDeal = useConvertDeal();
  const navigate = useNavigate();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keyed remount below resets these whenever a different deal is opened.
  const [businessName, setBusinessName] = useState(deal?.businessName ?? "");
  const [contactName, setContactName] = useState(deal?.contactName ?? "");
  const [contactEmail, setContactEmail] = useState(deal?.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(deal?.contactPhone ?? "");
  const [source, setSource] = useState(deal?.source ?? "");
  const [stage, setStage] = useState<DealStage>(deal?.stage ?? "New");
  const [estimatedValue, setEstimatedValue] = useState(
    deal?.estimatedValue !== null && deal?.estimatedValue !== undefined
      ? String(deal.estimatedValue)
      : ""
  );
  const [notes, setNotes] = useState(deal?.notes ?? "");
  const [lostReason, setLostReason] = useState(deal?.lostReason ?? "");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload = {
      businessName: businessName.trim(),
      contactName: contactName.trim() || null,
      contactEmail: contactEmail.trim() || null,
      contactPhone: contactPhone.trim() || null,
      source: source.trim() || null,
      stage,
      estimatedValue: estimatedValue ? Number(estimatedValue) : null,
      notes: notes.trim() || null,
      lostReason: stage === "Lost" ? lostReason.trim() || null : null,
    };

    try {
      if (isEdit && deal) {
        await updateDeal.mutateAsync({ id: deal.id, data: payload });
      } else {
        await createDeal.mutateAsync(payload);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the deal");
    }
  };

  const handleConvert = async () => {
    if (!deal) return;
    const client = await convertDeal.mutateAsync({ id: deal.id, data: {} });
    onClose();
    navigate(`/clients/${client.id}`);
  };

  return (
    <>
      <SlideOverPanel
        open={open}
        onClose={onClose}
        title={isEdit ? "Edit deal" : "New deal"}
        description={isEdit ? undefined : "Track a prospect before they're a client."}
        footer={
          <div className="flex items-center justify-between gap-2">
            {isEdit ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1 rounded p-1.5 text-xs text-ink/65 hover:bg-danger/10 hover:text-danger"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Delete
              </button>
            ) : (
              <span />
            )}

            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                form="deal-form"
                loading={createDeal.isPending || updateDeal.isPending}
                disabled={businessName.trim().length === 0}
              >
                {isEdit ? "Save" : "Create deal"}
              </Button>
            </div>
          </div>
        }
      >
        <form id="deal-form" onSubmit={handleSubmit} className="space-y-4">
          <Field label="Business name" htmlFor="deal-business">
            <input
              id="deal-business"
              className="input"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              autoFocus
            />
          </Field>

          <Field label="Contact name" htmlFor="deal-contact">
            <input
              id="deal-contact"
              className="input"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Email" htmlFor="deal-email">
              <input
                id="deal-email"
                type="email"
                className="input"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </Field>
            <Field label="Phone" htmlFor="deal-phone">
              <input
                id="deal-phone"
                type="tel"
                className="input"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Stage" htmlFor="deal-stage">
              <select
                id="deal-stage"
                className="input"
                value={stage}
                onChange={(e) => setStage(e.target.value as DealStage)}
              >
                {STAGES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Estimated value" htmlFor="deal-value">
              <input
                id="deal-value"
                type="number"
                min="0"
                step="100"
                className="input"
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Source" htmlFor="deal-source" hint="referral, cold outreach, instagram DM…">
            <input
              id="deal-source"
              className="input"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </Field>

          {stage === "Lost" && (
            <Field label="Lost reason" htmlFor="deal-lost">
              <input
                id="deal-lost"
                className="input"
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                placeholder="Price, timing, went with someone else…"
              />
            </Field>
          )}

          <Field label="Notes" htmlFor="deal-notes">
            <textarea
              id="deal-notes"
              className="input min-h-[6rem]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>

          {error && <p className="text-sm text-danger">{error}</p>}

          {isEdit && deal && !deal.clientId && (
            <div className="rounded-lg border border-accent/30 bg-accent/10 p-3">
              <p className="text-xs text-accent">
                Won this one? Convert it into a client record and start the ladder.
              </p>
              <Button
                type="button"
                size="sm"
                className="mt-2"
                loading={convertDeal.isPending}
                onClick={handleConvert}
              >
                Convert to client
              </Button>
            </div>
          )}

          {isEdit && deal?.clientId && (
            <p className="text-xs text-ink/70">
              Already converted —{" "}
              <button
                type="button"
                className="font-medium text-accent hover:underline"
                onClick={() => navigate(`/clients/${deal.clientId}`)}
              >
                open the client record
              </button>
              .
            </p>
          )}
        </form>
      </SlideOverPanel>

      <ConfirmModal
        open={confirmDelete}
        title="Delete this deal?"
        tone="danger"
        confirmLabel="Delete"
        loading={deleteDeal.isPending}
        body="This can't be undone. If you lost the deal, move it to the Lost column instead so you keep the record."
        onConfirm={async () => {
          if (deal) await deleteDeal.mutateAsync(deal.id);
          setConfirmDelete(false);
          onClose();
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
