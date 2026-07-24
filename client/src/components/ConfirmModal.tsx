import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "./ui";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger" | "warning";
  loading?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Generic confirm dialog — used for tier changes, deletions and deal conversion. */
export function ConfirmModal({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  loading = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 animate-fade-in bg-slate-900/40" onClick={onCancel} aria-hidden />
      <div className="relative w-full max-w-md animate-fade-in rounded-xl bg-white p-5 shadow-xl">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {body && <div className="mt-2 text-sm text-slate-600">{body}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone}
            onClick={onConfirm}
            loading={loading}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
