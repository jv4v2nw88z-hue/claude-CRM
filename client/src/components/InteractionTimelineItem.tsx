import { Link } from "react-router-dom";
import { CalendarDays, Mail, MapPin, MessageSquare, MoreHorizontal, Phone } from "lucide-react";
import type { InteractionType } from "../types";
import { formatDate, INTERACTION_LABELS } from "../lib/format";

const ICONS: Record<InteractionType, typeof Phone> = {
  CALL: Phone,
  EMAIL: Mail,
  MEETING: CalendarDays,
  TEXT: MessageSquare,
  SITE_VISIT: MapPin,
  OTHER: MoreHorizontal,
};

const ICON_STYLES: Record<InteractionType, string> = {
  CALL: "bg-blue-100 text-blue-600",
  EMAIL: "bg-purple-100 text-purple-600",
  MEETING: "bg-emerald-100 text-emerald-600",
  TEXT: "bg-teal-100 text-teal-600",
  SITE_VISIT: "bg-amber-100 text-amber-600",
  OTHER: "bg-slate-100 text-slate-600",
};

interface InteractionTimelineItemProps {
  type: InteractionType;
  summary: string;
  occurredAt: string;
  loggedBy?: string | null;
  clientName?: string;
  clientId?: string;
  isLast?: boolean;
}

export function InteractionTimelineItem({
  type,
  summary,
  occurredAt,
  loggedBy,
  clientName,
  clientId,
  isLast = false,
}: InteractionTimelineItemProps) {
  const Icon = ICONS[type];

  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {!isLast && <span className="absolute left-[15px] top-8 h-full w-px bg-slate-200" aria-hidden />}

      <span
        className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${ICON_STYLES[type]}`}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </span>

      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-slate-500">
          <span className="font-medium text-slate-700">{INTERACTION_LABELS[type]}</span>
          <span>{formatDate(occurredAt)}</span>
          {loggedBy && <span>· {loggedBy}</span>}
          {clientName && clientId && (
            <Link
              to={`/clients/${clientId}`}
              className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600 hover:bg-slate-200"
            >
              {clientName}
            </Link>
          )}
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{summary}</p>
      </div>
    </li>
  );
}
