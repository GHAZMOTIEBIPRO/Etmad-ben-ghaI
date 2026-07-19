import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-6 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-700 text-lg font-black text-white shadow-sm">ع+</span>
          <div><div className="text-lg font-black text-slate-950">اعتماد بلس</div><div className="text-xs font-medium text-slate-500">Etimad Plus</div></div>
        </Link>
        <nav className="flex items-center gap-2 text-sm font-bold text-slate-600"><Link className="rounded-xl px-3 py-2 hover:bg-slate-100 hover:text-emerald-800" href="/">المنافسات</Link><Link className="rounded-xl px-3 py-2 hover:bg-slate-100 hover:text-emerald-800" href="/analytics">التحليلات</Link></nav>
      </div>
    </header>
  );
}
