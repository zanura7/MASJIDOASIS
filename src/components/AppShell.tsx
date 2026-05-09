"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Activity, BookOpen, HeartHandshake, Home, Landmark, MessageCircleQuestion, Package, Plane, ShoppingBag, User, Wallet, Banknote, Rocket, Calendar, Menu, X } from "lucide-react";

const sidebarItems = [
  { href: "/", icon: Home, label: "Beranda" },
  { href: "/masjid", icon: Landmark, label: "Masjid" },
  { href: "/muamalah", icon: Banknote, label: "Muamalah" },
  { href: "/marketplace", icon: ShoppingBag, label: "Marketplace" },
  { href: "/orders", icon: Package, label: "Pesanan" },
  { href: "/dakwah", icon: BookOpen, label: "Dakwah" },
  { href: "/infaq", icon: HeartHandshake, label: "Infaq" },
  { href: "/events", icon: Calendar, label: "Event" },
  { href: "/ota", icon: Plane, label: "Travel" },
  { href: "/crowdfunding", icon: Rocket, label: "Crowdfunding" },
  { href: "/wallet", icon: Wallet, label: "Wallet" },
  { href: "/tanya-ustadz", icon: MessageCircleQuestion, label: "Tanya Ustadz" },
  { href: "/test-kesehatan", icon: Activity, label: "Kesehatan" },
];

const bottomNavItems = [
  { href: "/", icon: Home, label: "Beranda", short: "Beranda" },
  { href: "/masjid", icon: Landmark, label: "Masjid", short: "Masjid" },
  { href: "/muamalah", icon: Banknote, label: "Muamalah", short: "Muamalah" },
  { href: "/profile", icon: User, label: "Profil", short: "Profil" },
];

export function AppShell({ children, active = "/" }: { children: React.ReactNode; active?: string }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <main className="min-h-screen bg-[#f6f7f4]">
      {/* Header Mobile / Tablet */}
      <div className="sticky top-0 z-40 flex h-16 items-center border-b border-emerald-100 bg-white/80 px-4 backdrop-blur lg:hidden">
        <button 
          onClick={() => setSidebarOpen(true)}
          className="rounded-xl p-2 text-slate-700 hover:bg-emerald-50 active:scale-95 transition"
        >
          <Menu className="h-6 w-6" />
        </button>
        <div className="ml-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-700 text-sm font-black text-white">MO</div>
          <span className="font-black text-slate-900">Masjid Oasis</span>
        </div>
      </div>

      <div className="mx-auto flex min-h-screen max-w-7xl">
        {/* Overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 z-50 bg-black/50 lg:hidden" 
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* User Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-[60] w-72 shrink-0 border-r border-emerald-100 bg-white p-6 transition-all duration-300 ease-in-out lg:translate-x-[-275px] lg:hover:translate-x-0 lg:overflow-y-auto ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="hidden lg:block absolute right-2 top-1/2 -translate-y-1/2 opacity-30">
            <div className="h-10 w-1 rounded-full bg-emerald-300" />
          </div>
          {/* Close button (mobile) */}
          <button 
            onClick={() => setSidebarOpen(false)}
            className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 hover:bg-slate-50 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>

          <Link href="/" className="mb-8 flex items-center gap-3" onClick={() => setSidebarOpen(false)}>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-700 text-xl font-black text-white">MO</div>
            <div>
              <p className="text-lg font-black text-slate-900 leading-tight">Masjid Oasis</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Komunitas & Syariah</p>
            </div>
          </Link>
          
          <nav className="space-y-1.5 text-sm font-semibold">
            {sidebarItems.map(({ href, icon: Icon, label }) => (
              <Link 
                key={href} 
                href={href} 
                onClick={() => setSidebarOpen(false)} 
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition-all ${active === href ? "bg-emerald-700 text-white shadow-md scale-[1.02]" : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"}`}
              >
                <Icon className={`h-5 w-5 ${active === href ? "text-emerald-200" : "text-emerald-600"}`} />
                {label}
              </Link>
            ))}
          </nav>
        </aside>

        <section className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-8">
          {children}
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-100 bg-white/95 px-2 py-2 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
        <div className="hide-scrollbar mx-auto flex max-w-xl gap-1 overflow-x-auto text-[11px] font-bold text-slate-500">
          {bottomNavItems.map(({ href, icon: Icon, short }) => (
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
