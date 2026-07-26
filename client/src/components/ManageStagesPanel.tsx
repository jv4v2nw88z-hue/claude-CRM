import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Plus, Trash2, X } from "lucide-react";
import {
  useCreatePipelineStage,
  useDeletePipelineStage,
  usePipelineStages,
  useReorderPipelineStages,
  useUpdatePipelineStage,
} from "../hooks/queries";
import { ApiError } from "../api/apiClient";
import type { PipelineStage } from "../types";
import { SlideOverPanel } from "./SlideOverPanel";
import { Button, Field, Skeleton } from "./ui";

/**
 * Pipeline stage management. TECHNICAL only — the caller gates rendering, and
 * the API refuses the writes regardless, so a hidden button is a convenience
 * rather than the control.
 *
 * Reorder is arrow buttons rather than drag-and-drop on purpose: the board
 * itself is already a drag surface, and nesting a second one inside a slide-over
 * is both fiddly on a phone and unreachable by keyboard without extra work.
 */
export function ManageStagesPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const stagesQuery = usePipelineStages();
  const createStage = useCreatePipelineStage();
  const updateStage = useUpdatePipelineStage();
  const reorder = useReorderPipelineStages();
  const removeStage = useDeletePipelineStage();

  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PipelineStage | null>(null);
  const [reassignTo, setReassignTo] = useState("");

  const stages = stagesQuery.data ?? [];

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That didn't work.");
    }
  };

  const move = (index: number, delta: number) => {
    const next = [...stages];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    void run(() => reorder.mutateAsync(next.map((s) => s.id)));
  };

  const confirmDelete = (stage: PipelineStage) => {
    setError(null);
    setReassignTo("");
    setPendingDelete(stage);
  };

  const doDelete = () =>
    run(async () => {
      if (!pendingDelete) return;
      await removeStage.mutateAsync({
        id: pendingDelete.id,
        reassignToId: reassignTo || undefined,
      });
      setPendingDelete(null);
    });

  return (
    <SlideOverPanel
      open={open}
      onClose={onClose}
      title="Pipeline stages"
      description="Rename, reorder, or add columns to the deal board."
      footer={
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      }
    >
      {stagesQuery.isLoading ? (
        <Skeleton className="h-48" />
      ) : (
        <div className="space-y-4">
          <ul className="list-group">
            {stages.map((stage, index) => (
              <StageRow
                key={stage.id}
                stage={stage}
                index={index}
                total={stages.length}
                onMove={move}
                onRename={(name) => run(() => updateStage.mutateAsync({ id: stage.id, data: { name } }))}
                onToggle={(data) => run(() => updateStage.mutateAsync({ id: stage.id, data }))}
                onDelete={() => confirmDelete(stage)}
              />
            ))}
          </ul>

          <div className="space-y-2 border-t border-separator/60 pt-4">
            <Field label="Add a stage" htmlFor="new-stage">
              <div className="flex gap-2">
                <input
                  id="new-stage"
                  className="input"
                  value={newName}
                  placeholder="Proposal Sent"
                  onChange={(e) => setNewName(e.target.value)}
                />
                <Button
                  disabled={!newName.trim() || createStage.isPending}
                  loading={createStage.isPending}
                  onClick={() =>
                    void run(async () => {
                      await createStage.mutateAsync({ name: newName.trim() });
                      setNewName("");
                    })
                  }
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Add
                </Button>
              </div>
            </Field>
            <p className="text-xs text-ink/65">
              The green column is where a deal becomes a client. The red one marks a deal lost.
            </p>
          </div>

          {pendingDelete && (
            <div className="space-y-3 rounded-box border border-danger/30 bg-danger/10 p-3">
              <p className="text-sm text-ink">
                Delete <strong>{pendingDelete.name}</strong>?
              </p>
              {(pendingDelete._count?.deals ?? 0) > 0 ? (
                <>
                  <p className="text-xs text-ink/70">
                    {pendingDelete._count?.deals} deal
                    {pendingDelete._count?.deals === 1 ? "" : "s"} sitting here. Pick where they
                    should go.
                  </p>
                  <select
                    className="input"
                    value={reassignTo}
                    onChange={(e) => setReassignTo(e.target.value)}
                    aria-label="Move deals to"
                  >
                    <option value="">Choose a stage…</option>
                    {stages
                      .filter((s) => s.id !== pendingDelete.id)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </>
              ) : (
                <p className="text-xs text-ink/70">It's empty, so nothing moves.</p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  loading={removeStage.isPending}
                  disabled={(pendingDelete._count?.deals ?? 0) > 0 && !reassignTo}
                  onClick={() => void doDelete()}
                >
                  Delete stage
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setPendingDelete(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {error && (
            <p
              className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger"
              role="alert"
            >
              {error}
            </p>
          )}
        </div>
      )}
    </SlideOverPanel>
  );
}

function StageRow({
  stage,
  index,
  total,
  onMove,
  onRename,
  onToggle,
  onDelete,
}: {
  stage: PipelineStage;
  index: number;
  total: number;
  onMove: (index: number, delta: number) => void;
  onRename: (name: string) => void;
  onToggle: (data: { isWon?: boolean; isLost?: boolean }) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(stage.name);

  const commit = () => {
    const name = draft.trim();
    if (name && name !== stage.name) onRename(name);
    setEditing(false);
  };

  return (
    <li className="flex items-center gap-2 p-3">
      <div className="flex flex-col">
        <button
          type="button"
          aria-label={`Move ${stage.name} earlier`}
          disabled={index === 0}
          onClick={() => onMove(index, -1)}
          className="rounded p-0.5 text-ink/55 hover:bg-fill/20 hover:text-ink disabled:opacity-30"
        >
          <ArrowUp className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          type="button"
          aria-label={`Move ${stage.name} later`}
          disabled={index === total - 1}
          onClick={() => onMove(index, 1)}
          className="rounded p-0.5 text-ink/55 hover:bg-fill/20 hover:text-ink disabled:opacity-30"
        >
          <ArrowDown className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex gap-1">
            <input
              className="input"
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") {
                  setDraft(stage.name);
                  setEditing(false);
                }
              }}
              aria-label={`Rename ${stage.name}`}
            />
            <button
              type="button"
              onClick={commit}
              aria-label="Save name"
              className="rounded p-1.5 text-accent hover:bg-accent/10"
            >
              <Check className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(stage.name);
                setEditing(false);
              }}
              aria-label="Cancel rename"
              className="rounded p-1.5 text-ink/55 hover:bg-fill/20"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="truncate text-left text-sm font-medium text-ink hover:underline"
          >
            {stage.name}
          </button>
        )}
        <p className="text-xs text-ink/65">
          {stage._count?.deals ?? 0} deal{(stage._count?.deals ?? 0) === 1 ? "" : "s"}
        </p>
      </div>

      {/* Radio-like behaviour, deliberately: the API moves the flag rather than
          adding a second holder, so clicking Won here clears it elsewhere. */}
      <button
        type="button"
        onClick={() => onToggle({ isWon: !stage.isWon, isLost: false })}
        aria-pressed={stage.isWon}
        className={
          stage.isWon
            ? "rounded-full bg-success/20 px-2 py-0.5 text-xs font-medium text-success"
            : "rounded-full px-2 py-0.5 text-xs text-ink/55 hover:bg-fill/20"
        }
      >
        Won
      </button>
      <button
        type="button"
        onClick={() => onToggle({ isLost: !stage.isLost, isWon: false })}
        aria-pressed={stage.isLost}
        className={
          stage.isLost
            ? "rounded-full bg-danger/20 px-2 py-0.5 text-xs font-medium text-danger"
            : "rounded-full px-2 py-0.5 text-xs text-ink/55 hover:bg-fill/20"
        }
      >
        Lost
      </button>

      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${stage.name}`}
        className="flex h-9 w-9 items-center justify-center rounded-control text-ink/55 hover:bg-danger/10 hover:text-danger"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
    </li>
  );
}
