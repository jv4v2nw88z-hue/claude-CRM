import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { GripVertical, User } from "lucide-react";
import type { Deal } from "../types";
import { daysFromToday, formatCurrency } from "../lib/format";

interface DealCardProps {
  deal: Deal;
  onOpen: (deal: Deal) => void;
  isOverlay?: boolean;
}

export function DealCard({ deal, onOpen, isOverlay = false }: DealCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    data: { deal },
  });

  const daysInStage = Math.abs(daysFromToday(deal.stageChangedAt));

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={clsx(
        "rounded-lg border border-separator/70 bg-content p-3 shadow-sm",
        isDragging && "opacity-40",
        isOverlay && "rotate-2 shadow-lg"
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          // A 16px grip is hard to hit with a thumb and it is the only way to
          // move a deal between stages, so the target is 44px on touch.
          className="-my-1.5 -ml-1.5 flex h-11 w-11 shrink-0 cursor-grab touch-none items-center
                     justify-center rounded text-ink/55 hover:text-ink/70
                     active:cursor-grabbing lg:-my-0 lg:-ml-0 lg:mt-0.5 lg:h-6 lg:w-6"
          aria-label={`Drag ${deal.businessName}`}
          {...listeners}
          {...attributes}
        >
          <GripVertical className="h-4 w-4" aria-hidden />
        </button>

        <button
          type="button"
          onClick={() => onOpen(deal)}
          className="min-w-0 flex-1 text-left"
        >
          <p className="truncate text-sm font-medium text-ink">{deal.businessName}</p>

          {deal.contactName && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink/70">
              <User className="h-3 w-3 shrink-0" aria-hidden />
              {deal.contactName}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {deal.estimatedValue !== null && (
              <span className="rounded bg-success/10 px-1.5 py-0.5 text-xs font-medium tabular-nums text-success">
                {formatCurrency(deal.estimatedValue)}
              </span>
            )}
            {deal.source && (
              <span className="rounded bg-fill/15 px-1.5 py-0.5 text-xs text-ink/70">
                {deal.source}
              </span>
            )}
          </div>

          <p className="mt-2 text-xs text-ink/65">
            {daysInStage === 0 ? "Moved today" : `${daysInStage}d in stage`}
          </p>
        </button>
      </div>
    </div>
  );
}
