import type { DashboardStats } from "@/lib/types";
import { currency, number } from "@/lib/format";

export function StatCards({ stats }: { stats: DashboardStats }) {
  const cards = [
    ["الفرص المرصودة", number.format(stats.totalTenders)],
    ["الترسيات المعلنة", number.format(stats.totalAwards)],
    ["قيمة الترسيات", currency.format(stats.totalAwardValue)],
    ["جهات ومنصات الطرح", number.format(stats.totalGovernmentEntities)],
    ["الشركات الفائزة", number.format(stats.totalWinningCompanies)],
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-slate-200/80 bg-white/90 p-4">
          <div className="text-xs font-bold text-slate-500">{label}</div>
          <div className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</div>
        </div>
      ))}
    </div>
  );
}
