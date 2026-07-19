import Link from "next/link";
export default function NotFound() {
  return <main className="mx-auto max-w-3xl px-4 py-20 text-center"><div className="text-6xl font-black text-emerald-700">404</div><h1 className="mt-4 text-2xl font-black">الصفحة غير موجودة</h1><Link href="/" className="mt-6 inline-block rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white">العودة للرئيسية</Link></main>;
}
