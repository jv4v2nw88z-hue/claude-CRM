import clsx from "clsx";
import type { ServiceTierType } from "../types";
import { TIER_LABELS } from "../lib/format";

/*
 * The one place literal hues survive the semantic-token rename, because the
 * ladder is read by colour: six tiers have to stay distinguishable at a glance,
 * and six shades of one accent would not be. Each carries an explicit dark pair
 * — a 100-level tint is nearly white, so on a dark surface it reads as a
 * highlight rather than a category. Dark uses a translucent fill of the same hue
 * with light text, which is how macOS tints on dark backgrounds.
 */
const TIER_STYLES: Record<ServiceTierType, string> = {
  PROSPECT: "bg-fill/15 text-ink/70",
  WEBSITE_BUILD: "bg-blue-100 text-blue-700 dark:bg-blue-400/20 dark:text-blue-200",
  // Danger-zone tier, always flagged.
  WEBSITE_LIVE: "bg-amber-100 text-amber-800 dark:bg-amber-400/20 dark:text-amber-200",
  BRAND_CURATION: "bg-purple-100 text-purple-700 dark:bg-purple-400/20 dark:text-purple-200",
  SOCIAL_MEDIA: "bg-teal-100 text-teal-700 dark:bg-teal-400/20 dark:text-teal-200",
  ANALYTICS: "bg-indigo-100 text-indigo-700 dark:bg-indigo-400/25 dark:text-indigo-200",
  CHURNED: "bg-red-100 text-red-700 dark:bg-red-400/20 dark:text-red-200",
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
