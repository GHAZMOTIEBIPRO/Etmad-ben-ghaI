"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function RefreshViewButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:border-emerald-200 hover:text-emerald-800 disabled:cursor-wait disabled:opacity-60"
    >
      <span aria-hidden="true" className={pending ? "animate-spin" : ""}>↻</span>
      {pending ? "جارٍ التحديث" : "تحديث العرض"}
    </button>
  );
}
