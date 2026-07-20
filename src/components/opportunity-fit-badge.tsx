import { scoreOpportunity } from "@/lib/opportunity-fit";
import type { Tender } from "@/lib/types";

export function OpportunityFitBadge({ tender }: { tender: Tender }) {
  const fit = scoreOpportunity(tender);
  const tone = fit.score >= 85
    ? "bg-emerald-100 text-emerald-900"
    : fit.score >= 70
      ? "bg-teal-100 text-teal-900"
      : fit.score >= 55
        ? "bg-amber-100 text-amber-900"
        : "bg-slate-100 text-slate-700";

  return (
    <span
      className={`inline-flex min-w-16 items-center justify-center rounded-full px-2.5 py-1 text-xs font-black ${tone}`}
      title={fit.reasons.join(" • ") || "تقييم أولي حسب نطاق عمل بن غازي"}
    >
      {fit.score}/100
    </span>
  );
}
