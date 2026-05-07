import Link from "next/link";
import { Activity, BookOpen, HeartHandshake, Home, MessageCircleQuestion, Package, ShoppingBag, Wallet } from "lucide-react";

const navItems = [
  { href: "/", icon: Home, label: "Dashboard", short: "Home" },
  { href: "/marketplace", icon: ShoppingBag, label: "Marketplace", short: "Market" },
  { href: "/orders", icon: Package, label: "Pesanan", short: "Order" },
  { href: "/dakwah", icon: BookOpen, label: "Dakwah", short: "Dakwah" },
  { href: "/infaq", icon: HeartHandshake, label: "Infaq", short: "Infaq" },
  { href: "/wallet", icon: Wallet, label: "Wallet", short: "Wallet" },
  { href: "/tanya-ustadz", icon: MessageCircleQuestion, label: "Tanya Ustadz", short: "Ustadz" },
  { href: "/test-kesehatan", icon: Activity, label: "Kesehatan", short: "Sehat" },
];

export function AppShell({ children, active = "/" }: { children: React.ReactNode; active?: string }) {
  return (
    <main className="min-h-screen bg-[#f6f7f4]">
      <div className="mx-auto flex min-h-screen max-w-7xl">
        <aside className="hidden w-72 shrink-0 border-r border-emerald-100 bg-white/85 p-6 lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-y-auto">
          <Link href="/" className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-700 text-xl font-black text-white">MO</div>
            <div>
              <p className="text-lg font-black text-slate-900">Masjid Oasis</p>
              <p className="text-xs text-slate-500">Komunitas & Marketplace</p>
            </div>
          </Link>
          <nav className="space-y-2 text-sm font-semibold">
            {navItems.map(({ href, icon: Icon, label }) => (
              <Link key={href} href={href} className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${active === href ? "bg-emerald-700 text-white shadow-sm" : "text-slate-600 hover:bg-emerald-50"}`}>
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            ))}
          </nav>
        </aside>

        <section className="min-w-0 flex-1 px-3 pb-28 pt-4 sm:px-5 md:px-8 lg:pb-8">
          {children}
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-100 bg-white/95 px-2 py-2 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
        <div className="hide-scrollbar mx-auto flex max-w-xl gap-1 overflow-x-auto text-[11px] font-bold text-slate-500">
          {navItems.map(({ href, icon: Icon, short }) => (
            <Link key={href} href={href} className={`flex min-w-[64px] flex-col items-center gap-1 rounded-2xl px-2 py-2 ${active === href ? "bg-emerald-50 text-emerald-700" : ""}`}>
              <Icon className="h-5 w-5" />
              <span>{short}</span>
            </Link>
          ))}
        </div>
      </nav>
    </main>
  );
}
