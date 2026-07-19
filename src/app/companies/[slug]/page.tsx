import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TenderTable } from "@/components/tender-table";
import { currency, number } from "@/lib/format";
import { getCompanyProfile } from "@/lib/repository";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getCompanyProfile(slug);
  return { title: profile?.company.name ?? "الشركة" };
}

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await getCompanyProfile(slug);
  if (!profile) notFound();
  const metrics = [["إجمالي الظهور", number.format(profile.appearances)], ["مرات الفوز", number.format(profile.wins)], ["مرات الخسارة", number.format(profile.losses)], ["نسبة الفوز", `${profile.winRate.toFixed(1)}%`], ["إجمالي قيمة العقود", currency.format(profile.totalAwardValue)], ["متوسط قيمة العقد", currency.format(profile.averageAwardValue)], ["أكبر عقد", currency.format(profile.largestAward)], ["أصغر عقد", currency.format(profile.smallestAward)]];
  return (
    <main className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8">
      <Link href="/" className="text-sm font-bold text-emerald-800 hover:underline">← العودة إلى المنافسات</Link>
      <div className="mt-5"><div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><div className="text-xs font-black text-emerald-700">ملف الشركة / المورد</div><h1 className="mt-2 text-3xl font-black text-slate-950">{profile.company.name}</h1><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{metrics.map(([label, value]) => <div key={label} className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-extrabold text-slate-500">{label}</div><div className="mt-2 text-xl font-black text-slate-950">{value}</div></div>)}</div></div><section className="mt-8 space-y-4"><div><h2 className="text-xl font-black">المنافسات المرتبطة بالشركة</h2><p className="mt-1 text-sm text-slate-500">في وضع البيانات التجريبية تظهر المنافسات الفائزة فقط. عند تفعيل بيانات المشاركات الحقيقية تُحسب الخسائر ونسبة الفوز من جدول المشاركات.</p></div><TenderTable items={profile.tenders} /></section></div>
    </main>
  );
}
