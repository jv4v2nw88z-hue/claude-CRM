import { useEffect } from "react";
import { Undo2, X } from "lucide-react";

/**
 * Undo for a destructive action.
 *
 * Deleting a client used to be a one-way door: the record vanished from every
 * view and the only way back was a developer running SQL. The delete is a soft
 * one, so the recovery already existed in the data — it just had no route to it.
 *
 * Deliberately not auto-dismissing. The usual five-second toast is a race
 * between noticing the mistake and the button disappearing, and this is the
 * mistake most worth being able to reverse — an entire client relationship.
 */
export function UndoToast({
  message,
  onUndo,
  onDismiss,
  isUndoing = false,
}: {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  isUndoing?: boolean;
}) {
  // Escape dismisses, matching every other transient surface in the app.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md animate-sheet-in items-center
                 gap-3 rounded-box border border-separator/70 bg-elevated p-3 shadow-popover
                 sm:inset-x-auto sm:right-6"
    >
      <p className="min-w-0 flex-1 text-sm text-ink">{message}</p>

      <button
        type="button"
        onClick={onUndo}
        disabled={isUndoing}
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-control px-3 text-sm
                   font-medium text-accent hover:bg-accent/10 disabled:opacity-50 lg:min-h-8"
      >
        <Undo2 className="h-4 w-4" aria-hidden />
        Undo
      </button>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-ink/55
                   hover:bg-fill/15 hover:text-ink lg:h-8 lg:w-8"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
