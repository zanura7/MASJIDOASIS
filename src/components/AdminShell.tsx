import Link from "next/link";
import { Activity, BookOpen, HeartHandshake, LayoutDashboard, MessageCircleQuestion, Package, ShoppingBag, Users, Wallet } from "lucide-react";

const adminNav = [
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/users", icon: Users, label: "Jamaah / User" },
  { href: "/admin/products", icon: ShoppingBag, label: "Produk" },
  { href: "/admin/orders", icon: Package, label: "Pesanan" },
  { href: "/admin/wallet", icon: Wallet, label: "Escrow & Wallet" },
  { href: "/admin/dakwah", icon: BookOpen, label: "Dakwah" },
  { href: "/admin/infaq", icon: HeartHandshake, label: "Infaq & Campaign" },
  { href: "/admin/qna", icon: MessageCircleQuestion, label: "Q&A Ustadz" },
];

export function AdminShell({ children, active = "/admin" }: { children: React.ReactNode; active?: string }) {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex min-h-screen max-w-[1400px]">
        {/* Admin Sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-slate-900 p-5 lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-y-auto">
          <Link href="/admin" className="mb-8 flex items-center gap-3 text-white">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 font-black">MO</div>
            <div>
              <p className="font-black leading-none tracking-wide">Admin Panel</p>
              <p className="text-[10px] font-semibold text-slate-400">Masjid Oasis</p>
            </div>
          </Link>
          <nav className="space-y-1 text-sm font-semibold">
            {adminNav.map(({ href, icon: Icon, label }) => (
              <Link key={href} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${active === href ? "bg-emerald-600 text-white shadow-sm" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <section className="min-w-0 flex-1 px-4 pb-24 pt-6 sm:px-6 md:px-8 lg:pb-8">
          <header className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950">Dashboard Admin</h1>
              <p className="text-sm text-slate-500">Ringkasan aktivitas platform Masjid Oasis</p>
            </div>
            <div className="flex items-center gap-3">
              <a href="/" target="_blank" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50">Lihat Web</a>
            </div>
          </header>
          {children}
        </section>
      </div>

      {/* Admin Mobile Nav (simplified) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-slate-900 px-2 py-2 shadow-lg lg:hidden">
        <div className="hide-scrollbar mx-auto flex max-w-xl justify-between gap-1 overflow-x-auto text-[10px] font-bold text-slate-400">
          {adminNav.slice(0, 5).map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href} className={`flex min-w-[64px] flex-col items-center gap-1 rounded-xl px-2 py-2 ${active === href ? "bg-emerald-600 text-white" : ""}`}>
              <Icon className="h-5 w-5" />
              <span className="truncate w-full text-center">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </main>
  );
}

