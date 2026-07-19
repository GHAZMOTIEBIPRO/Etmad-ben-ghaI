export default function Loading() {
  return <main className="mx-auto max-w-[1500px] px-4 py-12 sm:px-6 lg:px-8"><div className="animate-pulse space-y-5"><div className="h-10 w-64 rounded-xl bg-slate-200" /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-28 rounded-2xl bg-slate-200" />)}</div><div className="h-96 rounded-2xl bg-slate-200" /></div></main>;
}
