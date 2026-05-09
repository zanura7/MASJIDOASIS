"use client";
import { useState } from "react";
import Link from "next/link";
import { Activity, BookOpen, Calendar, HeartHandshake, LayoutDashboard, MessageCircleQuestion, Package, ShoppingBag, Users, Wallet, Menu, X } from "lucide-react";

const adminNav = [
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/users", icon: Users, label: "Jamaah / User" },
  { href: "/admin/products", icon: ShoppingBag, label: "Produk" },
  { href: "/admin/orders", icon: Package, label: "Pesanan" },
  { href: "/admin/wallet", icon: Wallet, label: "Escrow & Wallet" },
  { href: "/admin/dakwah", icon: BookOpen, label: "Dakwah" },
  { href: "/admin/infaq", icon: HeartHandshake, label: "Infaq & Campaign" },
  { href: "/admin/events", icon: Calendar, label: "Event" },
  { href: "/admin/qna", icon: MessageCircleQuestion, label: "Q&A Ustadz" },
];

export function AdminShell({ children, active = "/admin" }: { children: React.ReactNode; active?: string }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Mobile Sticky Header */}
      <div className="sticky top-0 z-40 flex h-14 items-center border-b border-slate-200 bg-white px-4 lg:hidden">
        <button 
          onClick={() => setSidebarOpen(true)}
          className="rounded-xl p-2 text-slate-700 hover:bg-slate-100 active:scale-95 transition"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="ml-3 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-xs font-black text-white">MO</div>
          <span className="text-sm font-black text-slate-900">Admin Panel</span>
        </div>
      </div>

      <div className="mx-auto flex min-h-screen max-w-[1400px]">
        {/* Desktop — hover strip at left edge */}
        {!sidebarOpen && (
          <div 
            className="fixed left-0 top-0 z-[55] hidden h-full w-2 cursor-pointer lg:block"
            onMouseEnter={() => setSidebarOpen(true)}
          />
        )}

        {/* Overlay (mobile only) */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 z-[50] bg-black/50 lg:hidden" 
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Admin Sidebar — state-driven (mobile + desktop) */}
        <aside 
          className={`fixed inset-y-0 left-0 z-[60] w-64 shrink-0 border-r border-slate-200 bg-white p-5 transition-all duration-300 ease-in-out overflow-y-auto shadow-lg ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
          onMouseLeave={() => setSidebarOpen(false)}
        >
          {/* Close button (mobile) */}
          <button 
            onClick={() => setSidebarOpen(false)}
            className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 hover:bg-slate-100 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>

          <Link href="/admin" className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 font-black text-white shadow-sm">MO</div>
            <div>
              <p className="font-black leading-none tracking-wide text-slate-900">Admin Panel</p>
              <p className="text-[10px] font-semibold text-emerald-600">Masjid Oasis</p>
            </div>
          </Link>
          <nav className="space-y-1 text-sm font-semibold">
            {adminNav.map(({ href, icon: Icon, label }) => (
              <Link 
                key={href} 
                href={href} 
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${active === href ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"}`}
              >
                <Icon className={`h-5 w-5 shrink-0 ${active === href ? "text-emerald-100" : "text-emerald-600"}`} />
                <span className="truncate">{label}</span>
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <section className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-6 md:px-8 lg:pt-8 lg:pb-8">
          <header className="mb-6 flex items-center justify-between lg:mb-8">
            <div className="flex items-center gap-3">
              {/* Hamburger — desktop toggle */}
              <button 
                onClick={() => setSidebarOpen(s => !s)}
                className="hidden lg:flex rounded-xl border border-slate-200 bg-white p-2 text-slate-400 shadow-sm hover:bg-slate-50 hover:text-slate-700 transition-colors"
                title="Buka/Tutup sidebar"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">Dashboard Admin</h1>
                <p className="text-xs text-slate-500 sm:text-sm">Ringkasan aktivitas platform Masjid Oasis</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <a href="/" target="_blank" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50">Lihat Web</a>
            </div>
          </header>
          {children}
        </section>
      </div>

      {/* Admin Mobile Nav — all items, scrollable */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-2 py-2 shadow-[0_-8px_24px_rgba(0,0,0,0.06)] backdrop-blur lg:hidden">
        <div className="hide-scrollbar mx-auto flex max-w-xl gap-1 overflow-x-auto text-[10px] font-bold text-slate-500">
          {adminNav.map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href} className={`flex min-w-[64px] flex-col items-center gap-0.5 rounded-xl px-2 py-2 ${active === href ? "bg-emerald-50 text-emerald-700" : ""}`}>
              <Icon className="h-5 w-5" />
              <span className="truncate w-full text-center">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </main>
  );
}
