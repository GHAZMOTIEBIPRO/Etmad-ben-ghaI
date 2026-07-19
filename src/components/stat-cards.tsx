import type { DashboardStats } from "@/lib/types";
import { currency, number } from "@/lib/format";

export function StatCards({ stats }: { stats: DashboardStats }) {
  const cards = [["عدد المنافسات", number.format(stats.totalTenders)], ["عدد الترسيات", number.format(stats.totalAwards)], ["إجمالي قيمة الترسيات", currency.format(stats.totalAwardValue)], ["الجهات الحكومية", number.format(stats.totalGovernmentEntities)], ["الشركات الفائزة", number.format(stats.totalWinningCompanies)]];
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{cards.map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-sm font-semibold text-slate-500">{label}</div><div className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</div></div>)}</div>;
}
