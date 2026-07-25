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

/* Hue-coded like the tier badges, so each keeps an explicit dark pair. */
const ICON_STYLES: Record<InteractionType, string> = {
  CALL: "bg-blue-100 text-blue-600 dark:bg-blue-400/20 dark:text-blue-200",
  EMAIL: "bg-purple-100 text-purple-600 dark:bg-purple-400/20 dark:text-purple-200",
  MEETING: "bg-success/15 text-success",
  TEXT: "bg-teal-100 text-teal-600 dark:bg-teal-400/20 dark:text-teal-200",
  SITE_VISIT: "bg-warning/15 text-warning",
  OTHER: "bg-fill/15 text-ink/70",
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
      {!isLast && <span className="absolute left-[15px] top-8 h-full w-px bg-fill/25" aria-hidden />}

      <span
        className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${ICON_STYLES[type]}`}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </span>

      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-ink/70">
          <span className="font-medium text-ink/80">{INTERACTION_LABELS[type]}</span>
          <span>{formatDate(occurredAt)}</span>
          {loggedBy && <span>· {loggedBy}</span>}
          {clientName && clientId && (
            <Link
              to={`/clients/${clientId}`}
              className="rounded-full bg-fill/15 px-2 py-0.5 font-medium text-ink/70 hover:bg-fill/25"
            >
              {clientName}
            </Link>
          )}
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{summary}</p>
      </div>
    </li>
  );
}
