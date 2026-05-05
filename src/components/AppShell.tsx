import Link from "next/link";
import { BookOpen, HeartHandshake, Home, Package, ShoppingBag, UserRound, Wallet, MessageCircleQuestion } from "lucide-react";

const navItems = [
  { href: "/", icon: Home, label: "Dashboard" },
  { href: "/marketplace", icon: ShoppingBag, label: "Marketplace" },
  { href: "/orders", icon: Package, label: "Pesanan" },
  { href: "/dakwah", icon: BookOpen, label: "Dakwah" },
  { href: "/infaq", icon: HeartHandshake, label: "Infaq" },
  { href: "/profile", icon: UserRound, label: "Profil" },
];

export function AppShell({ children, active = "/" }: { children: React.ReactNode; active?: string }) {
  return <main className="min-h-screen bg-[#f6f7f4]"><div className="mx-auto flex min-h-screen max-w-7xl">
    <aside className="hidden w-72 border-r border-emerald-100 bg-white/80 p-6 lg:block">
      <Link href="/" className="mb-10 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-700 text-xl font-black text-white">MO</div>
        <div><p className="text-lg font-black text-slate-900">Masjid Oasis</p><p className="text-xs text-slate-500">Komunitas & Marketplace</p></div>
      </Link>
      <nav className="space-y-2 text-sm font-semibold">
        {navItems.map(({ href, icon: Icon, label }) => <Link key={href} href={href} className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${active === href ? "bg-emerald-700 text-white" : "text-slate-600 hover:bg-emerald-50"}`}><Icon className="h-5 w-5" />{label}</Link>)}
        <div className="flex items-center gap-3 rounded-2xl px-4 py-3 text-slate-600 hover:bg-emerald-50"><Wallet className="h-5 w-5" />Wallet</div>
        <div className="flex items-center gap-3 rounded-2xl px-4 py-3 text-slate-600 hover:bg-emerald-50"><MessageCircleQuestion className="h-5 w-5" />Tanya Ustadz</div>
      </nav>
    </aside>
    <section className="flex-1 p-4 pb-24 md:p-8 lg:pb-8">{children}</section>
  </div><nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-100 bg-white/95 px-4 py-3 backdrop-blur lg:hidden"><div className="mx-auto flex max-w-md items-center justify-between text-xs font-semibold text-slate-500">{navItems.slice(0,5).map(({ href, icon: Icon, label }) => <Link key={href} href={href} className={`flex flex-col items-center gap-1 ${active === href ? "text-emerald-700" : ""}`}><Icon className="h-5 w-5" /><span>{label === "Marketplace" ? "Market" : label}</span></Link>)}</div></nav></main>;
}
