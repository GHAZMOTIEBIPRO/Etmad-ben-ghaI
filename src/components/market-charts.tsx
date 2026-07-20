"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Bucket {
  label: string;
  count: number;
  value: number;
}

function compact(value: number): string {
  return new Intl.NumberFormat("ar-SA", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function Chart({ title, items, valueMode = false }: { title: string; items: Bucket[]; valueMode?: boolean }) {
  const data = items.slice(0, 10).map((item) => ({
    name: item.label,
    count: item.count,
    value: item.value,
  }));

  return (
    <section className="surface-card rounded-2xl p-5 sm:p-6">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-lg font-black text-slate-950">{title}</h2>
        <span className="text-xs font-bold text-slate-400">أعلى {Math.min(10, data.length).toLocaleString("ar-SA")}</span>
      </div>
      <div className="mt-5 h-72 w-full" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 44 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" angle={-28} textAnchor="end" height={70} interval={0} tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={compact} tick={{ fontSize: 10 }} width={54} />
            <Tooltip formatter={(raw: number | string | undefined) => compact(Number(raw ?? 0))} />
            <Bar dataKey={valueMode ? "value" : "count"} fill="#047857" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export function MarketCharts({ stages, regions, sectors }: { stages: Bucket[]; regions: Bucket[]; sectors: Bucket[] }) {
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <Chart title="المشاريع حسب المرحلة" items={stages} />
      <Chart title="المشاريع حسب المنطقة" items={regions} />
      <Chart title="قيمة المشاريع حسب القطاع" items={sectors} valueMode />
    </div>
  );
}
