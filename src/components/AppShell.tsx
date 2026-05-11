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
  { href: "/infaq", icon: HeartHandshake, label: "Infaq" },
  { href: "/profile", icon: User, label: "Profil" },
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
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/20 to-slate-50">
      {/* Header Mobile / Tablet - Glassmorphism */}
      <div className="sticky top-0 z-40 flex h-16 items-center glass border-b border-emerald-100/50 px-4 shadow-sm lg:hidden">
        <button 
          onClick={() => setSidebarOpen(true)}
          className="rounded-xl p-2 text-slate-700 hover:bg-emerald-50 active:scale-95 transition-all duration-200"
        >
          <Menu className="h-6 w-6" />
        </button>
        <div className="ml-3 flex items-center gap-3">
          <Image src="/images/logo-masjid.jpg" alt="Logo Masjid" width={36} height={36} className="rounded-xl object-cover shadow-sm ring-2 ring-emerald-100" />
          <span className="font-extrabold text-slate-900 tracking-tight">Masjid Oasis</span>
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

        {/* User Sidebar - Premium */}
        <aside className={`fixed inset-y-0 left-0 z-[60] w-72 shrink-0 border-r border-emerald-100/50 bg-white shadow-premium-lg p-6 transition-all duration-300 ease-in-out lg:translate-x-[-275px] lg:hover:translate-x-0 lg:overflow-y-auto ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="hidden lg:block absolute right-2 top-1/2 -translate-y-1/2 opacity-40">
            <div className="h-12 w-1.5 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600" />
          </div>
          {/* Close button (mobile) */}
          <button 
            onClick={() => setSidebarOpen(false)}
            className="absolute right-4 top-4 rounded-xl p-2 text-slate-400 hover:bg-slate-50 transition-colors lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>

          <Link href="/" className="mb-10 flex items-center gap-3 group" onClick={() => setSidebarOpen(false)}>
            <Image src="/images/logo-masjid.jpg" alt="Logo Masjid" width={52} height={52} className="rounded-2xl object-cover shadow-md ring-2 ring-emerald-100 group-hover:ring-emerald-300 transition-all" />
            <div>
              <p className="text-lg font-black text-slate-900 leading-tight tracking-tight">Masjid Oasis</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Komunitas & Syariah</p>
            </div>
          </Link>
          
          <nav className="space-y-2 text-sm font-semibold">
            {sidebarItems.map(({ href, icon: Icon, label }) => (
              <Link 
                key={href} 
                href={href} 
                onClick={() => setSidebarOpen(false)} 
                className={`flex items-center gap-4 rounded-2xl px-4 py-3.5 transition-all duration-200 ${active === href ? "gradient-emerald text-white shadow-premium scale-[1.02]" : "text-slate-700 hover:bg-emerald-50/80 hover:text-emerald-700 hover:scale-[1.01]"}`}
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${active === href ? "bg-white/20" : "bg-emerald-100"}`}>
                  <Icon className={`h-5 w-5 ${active === href ? "text-white" : "text-emerald-700"}`} />
                </div>
                <span className="font-bold">{label}</span>
              </Link>
            ))}
          </nav>
        </aside>

        <section className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-8">
          {children}
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-emerald-100/50 glass px-2 py-2 shadow-[0_-8px_30px_rgba(4,120,87,0.05)] lg:hidden">
        <div className="hide-scrollbar mx-auto flex max-w-xl gap-1 overflow-x-auto text-[11px] font-bold text-slate-500 justify-around">
          {bottomNavItems.map(({ href, icon: Icon, short }) => (
            <Link key={href} href={href} className={`flex min-w-[64px] flex-col items-center gap-1.5 rounded-2xl px-2 py-2 transition-all duration-200 ${active === href ? "bg-emerald-50 text-emerald-700 shadow-sm" : "hover:bg-slate-50"}`}>
              <Icon className={`h-5 w-5 ${active === href ? "text-emerald-600" : "text-slate-400"}`} />
              <span className={active === href ? "font-extrabold" : "font-medium"}>{short}</span>
            </Link>
          ))}
        </div>
      </nav>
    </main>
  );
}
