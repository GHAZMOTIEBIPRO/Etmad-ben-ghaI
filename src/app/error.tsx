"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto max-w-3xl px-4 py-20 text-center"><h1 className="text-2xl font-black">تعذر تحميل الصفحة</h1><p className="mt-3 text-slate-600">حدث خطأ غير متوقع أثناء جلب البيانات.</p><button onClick={reset} className="mt-6 rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white">إعادة المحاولة</button></main>;
}
