import Link from "next/link";

const navItems = [
  ["/", "الفرص"],
  ["/contractors", "المقاولون"],
  ["/analytics", "التحليلات"],
  ["/sources", "المصادر"],
] as const;

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/75 bg-white/88 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="group flex min-w-0 items-center gap-3">
          <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-800 text-white shadow-[0_8px_24px_rgba(6,95,70,0.22)]">
            <span className="absolute h-6 w-6 rounded-full border border-white/40" />
            <span className="absolute h-3 w-3 rounded-full border border-white/70" />
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-base font-black text-slate-950 sm:text-lg">رادار المقاولات</div>
            <div className="truncate text-[11px] font-bold tracking-wide text-emerald-700">Construction Intelligence</div>
          </div>
        </Link>

        <nav className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-slate-200/80 bg-slate-50/80 p-1 text-sm font-black text-slate-600 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {navItems.map(([href, label]) => (
            <Link
              key={href}
              className="whitespace-nowrap rounded-xl px-3 py-2 transition hover:bg-white hover:text-emerald-800 hover:shadow-sm"
              href={href}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
