import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface SlideOverPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Right-side drawer used for every create/edit form in the app. */
export function SlideOverPanel({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: SlideOverPanelProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    // Stop the page behind the drawer scrolling under the user's thumb.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 animate-fade-in bg-black/30"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative flex h-full w-full max-w-md animate-slide-in flex-col bg-content shadow-xl">
        <header className="flex items-start justify-between border-b border-separator/70 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-ink/70">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-ink/65 hover:bg-fill/15 hover:text-ink/70"
            aria-label="Close panel"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <footer className="border-t border-separator/70 bg-fill/8 px-5 py-3">{footer}</footer>
        )}
      </div>
    </div>,
    document.body
  );
}
