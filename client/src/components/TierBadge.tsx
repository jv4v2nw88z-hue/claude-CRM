import clsx from "clsx";
import type { ServiceTierType } from "../types";
import { TIER_LABELS } from "../lib/format";

const TIER_STYLES: Record<ServiceTierType, string> = {
  PROSPECT: "bg-slate-100 text-slate-700",
  WEBSITE_BUILD: "bg-blue-100 text-blue-700",
  WEBSITE_LIVE: "bg-amber-100 text-amber-800", // danger-zone tier, always flagged
  BRAND_CURATION: "bg-purple-100 text-purple-700",
  SOCIAL_MEDIA: "bg-teal-100 text-teal-700",
  ANALYTICS: "bg-indigo-100 text-indigo-700",
  CHURNED: "bg-red-100 text-red-700",
};

export function TierBadge({
  tier,
  size = "sm",
  className,
}: {
  tier: ServiceTierType;
  size?: "sm" | "lg";
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full font-medium",
        size === "lg" ? "px-3 py-1.5 text-sm" : "px-2.5 py-1 text-xs",
        TIER_STYLES[tier],
        className
      )}
    >
      {TIER_LABELS[tier]}
    </span>
  );
}

export { TIER_STYLES };
