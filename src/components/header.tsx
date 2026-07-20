import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-700 text-lg font-black text-white shadow-sm">ر</span>
          <div><div className="text-lg font-black text-slate-950">رادار المقاولات</div><div className="text-xs font-medium text-slate-500">Construction Radar</div></div>
        </Link>
        <nav className="flex flex-wrap items-center gap-1 text-sm font-bold text-slate-600">
          <Link className="rounded-xl px-3 py-2 hover:bg-slate-100 hover:text-emerald-800" href="/">الفرص والمنافسات</Link>
          <Link className="rounded-xl px-3 py-2 hover:bg-slate-100 hover:text-emerald-800" href="/contractors">المقاولون</Link>
          <Link className="rounded-xl px-3 py-2 hover:bg-slate-100 hover:text-emerald-800" href="/analytics">التحليلات</Link>
          <Link className="rounded-xl px-3 py-2 hover:bg-slate-100 hover:text-emerald-800" href="/sources">المصادر</Link>
        </nav>
      </div>
    </header>
  );
}
