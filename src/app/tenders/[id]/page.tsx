import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { currency, formatDate, statusLabel } from "@/lib/format";
import { getTender } from "@/lib/repository";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const tender = await getTender(id);
  return { title: tender?.name ?? "المنافسة" };
}

export default async function TenderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tender = await getTender(id);
  if (!tender) notFound();
  const fields = [
    ["رقم المنافسة", tender.competitionNumber], ["الجهة الحكومية", tender.governmentEntityName], ["النشاط", tender.activityName], ["المجال", tender.sector], ["المنطقة", tender.regionName],
    ["قيمة الكراسة", tender.brochurePrice == null ? "—" : currency.format(tender.brochurePrice)], ["القيمة التقديرية", tender.estimatedValue == null ? "—" : currency.format(tender.estimatedValue)],
    ["تاريخ النشر", formatDate(tender.publicationDate)], ["آخر موعد للتقديم", formatDate(tender.submissionDeadline)], ["تاريخ فتح العروض", formatDate(tender.bidOpeningDate)],
    ["حالة المنافسة", statusLabel(tender.status)], ["تاريخ الترسية", formatDate(tender.award?.awardDate)], ["قيمة الترسية", tender.award ? currency.format(tender.award.amount) : "—"],
  ];
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <Link href="/" className="text-sm font-bold text-emerald-800 hover:underline">← العودة إلى المنافسات</Link>
      <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-start sm:justify-between"><div><div className="text-sm font-extrabold text-emerald-700">{tender.competitionNumber}</div><h1 className="mt-2 text-2xl font-black leading-tight text-slate-950 sm:text-4xl">{tender.name}</h1><p className="mt-4 max-w-3xl leading-8 text-slate-600">{tender.description}</p></div><span className="w-fit rounded-full bg-emerald-100 px-4 py-2 text-sm font-black text-emerald-800">{statusLabel(tender.status)}</span></div>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{fields.map(([label, value]) => <div key={label} className="rounded-2xl bg-slate-50 p-4"><dt className="text-xs font-extrabold text-slate-500">{label}</dt><dd className="mt-2 font-black text-slate-900">{value}</dd></div>)}</dl>
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><div className="text-xs font-extrabold text-emerald-700">المورد الفائز</div>{tender.award ? <Link href={`/companies/${tender.award.companySlug}`} className="mt-2 inline-block text-lg font-black text-emerald-950 hover:underline">{tender.award.companyName}</Link> : <div className="mt-2 font-bold text-slate-600">لم تُعلن ترسية لهذه المنافسة.</div>}</div>
      </div>
    </main>
  );
}
