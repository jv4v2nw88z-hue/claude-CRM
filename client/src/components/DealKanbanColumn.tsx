import { useDroppable } from "@dnd-kit/core";
import clsx from "clsx";
import type { Deal, DealStage } from "../types";
import { formatCurrency } from "../lib/format";
import { DealCard } from "./DealCard";

const STAGE_ACCENTS: Record<DealStage, string> = {
  New: "border-t-slate-400",
  Contacted: "border-t-blue-400",
  Quoted: "border-t-amber-400",
  Won: "border-t-emerald-500",
  Lost: "border-t-red-400",
};

interface DealKanbanColumnProps {
  stage: DealStage;
  deals: Deal[];
  onOpenDeal: (deal: Deal) => void;
}

export function DealKanbanColumn({ stage, deals, onOpenDeal }: DealKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const total = deals.reduce((sum, d) => sum + (d.estimatedValue ?? 0), 0);

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        "flex min-h-[16rem] w-72 shrink-0 flex-col rounded-xl border border-t-4 bg-fill/15/60 p-3 transition-colors",
        STAGE_ACCENTS[stage],
        isOver ? "border-brand-400 bg-accent/10" : "border-separator/70"
      )}
    >
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-ink/80">
          {stage}
          <span className="ml-1.5 text-xs font-normal text-ink/65">{deals.length}</span>
        </h3>
        {total > 0 && (
          <span className="text-xs tabular-nums text-ink/70">{formatCurrency(total)}</span>
        )}
      </div>

      <div className="flex-1 space-y-2">
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} onOpen={onOpenDeal} />
        ))}

        {deals.length === 0 && (
          <p className="rounded-lg border border-dashed border-separator px-3 py-6 text-center text-xs text-ink/65">
            Drop a deal here
          </p>
        )}
      </div>
    </div>
  );
}
