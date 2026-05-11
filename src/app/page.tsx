import { Landmark, Banknote, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { EventSlider } from "@/components/EventSlider";
import { events, feeds } from "@/data/mock";
import { SectionTitle, FeedCard } from "@/components/Cards";
import Link from "next/link";

export default function UserDashboardPage() {
  return (
    <AppShell active="/">
      <PageHeader eyebrow="Assalamu'alaikum, Adi" title="Dashboard Jamaah" />

      <EventSlider events={events} />

      <div className="mt-8 space-y-10">
        {/* Main Features */}
        <section>
          <SectionTitle title="Layanan Utama" />
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
            {/* Banner Masjid */}
            <Link
              href="/masjid"
              className="group relative flex items-center overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-900 p-6 sm:p-8 text-white shadow-premium hover:shadow-premium-lg transition-all duration-300 hover:-translate-y-1"
            >
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl group-hover:bg-white/20 transition-all duration-500" />
              <div className="relative flex items-center gap-4 sm:gap-6 w-full">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl glass sm:h-20 sm:w-20 shadow-inner border border-white/20 group-hover:scale-110 transition-transform duration-500">
                  <Landmark className="h-8 w-8 sm:h-10 sm:w-10 text-emerald-50 drop-shadow-md" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-200/80 sm:text-xs">Fitur Masjid</p>
                  </div>
                  <h2 className="mt-1 text-2xl font-black sm:mt-1.5 sm:text-3xl tracking-tight text-white drop-shadow-md">Kegiatan Masjid</h2>
                  <p className="mt-1.5 hidden text-sm leading-relaxed text-emerald-100/90 sm:block font-medium">
                    Jadwal sholat, pengumuman, dan kajian.
                  </p>
                </div>
              </div>
            </Link>

            {/* Banner Muamalah */}
            <Link
              href="/muamalah"
              className="group relative flex items-center overflow-hidden rounded-3xl bg-gradient-to-br from-gold via-yellow-500 to-amber-600 p-6 sm:p-8 text-white shadow-premium hover:shadow-premium-lg transition-all duration-300 hover:-translate-y-1"
            >
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/20 blur-2xl group-hover:bg-white/30 transition-all duration-500" />
              <div className="relative flex items-center gap-4 sm:gap-6 w-full">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl glass sm:h-20 sm:w-20 shadow-inner border border-white/30 group-hover:scale-110 transition-transform duration-500">
                  <Banknote className="h-8 w-8 sm:h-10 sm:w-10 text-amber-50 drop-shadow-md" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-100/90 sm:text-xs">Fitur Ekonomi</p>
                  <h2 className="mt-1 text-2xl font-black sm:mt-1.5 sm:text-3xl tracking-tight text-white drop-shadow-md">Ekonomi Syariah</h2>
                  <p className="mt-1.5 hidden text-sm leading-relaxed text-amber-50/90 sm:block font-medium">
                    Marketplace, Wallet, dan Infaq.
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </section>

        {/* Dakwah Feed */}
        <section>
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Kajian & Artikel</h3>
            <Link href="/dakwah" className="group flex items-center gap-1 text-sm font-bold text-emerald-700 hover:text-emerald-800 transition-colors">
              Lihat Semua
              <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
          <div className="space-y-4">
            {feeds.slice(0, 2).map(feed => (
              <FeedCard key={feed.id} feed={feed} />
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
