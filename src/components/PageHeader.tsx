import { Bell } from "lucide-react";

export function PageHeader({ eyebrow, title, wallet = "Rp 250.000" }: { eyebrow: string; title: string; wallet?: string }) {
  return <header className="mb-6 flex items-center justify-between gap-4"><div><p className="text-sm font-semibold text-emerald-700">{eyebrow}</p><h1 className="text-2xl font-black tracking-tight text-slate-950 md:text-4xl">{title}</h1></div><div className="flex items-center gap-3"><button className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-100"><Bell className="h-5 w-5" /></button><div className="hidden rounded-2xl bg-white px-4 py-2 shadow-sm ring-1 ring-slate-100 md:block"><p className="text-xs text-slate-500">Saldo wallet</p><p className="font-bold text-emerald-700">{wallet}</p></div></div></header>;
}
