import { Landmark, Banknote } from "lucide-react";
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
          <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
            {/* Banner Masjid */}
            <Link
              href="/masjid"
              className="group relative flex items-center overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-700 via-emerald-600 to-lime-600 p-6 sm:p-8 text-white shadow-lg transition-transform hover:scale-[1.01] active:scale-[0.98]"
            >
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5" />
              <div className="relative flex items-center gap-4 sm:gap-6">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur sm:h-20 sm:w-20 sm:rounded-[2rem]">
                  <Landmark className="h-8 w-8 sm:h-10 sm:w-10" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100 sm:text-xs">Fitur Masjid</p>
                  <h2 className="mt-0.5 text-xl font-black sm:mt-1 sm:text-2xl">Kegiatan Masjid</h2>
                  <p className="mt-1 hidden text-xs leading-relaxed text-emerald-50 sm:block sm:text-sm">
                    Jadwal sholat, pengumuman, dan kajian.
                  </p>
                </div>
              </div>
            </Link>

            {/* Banner Muamalah */}
            <Link
              href="/muamalah"
              className="group relative flex items-center overflow-hidden rounded-[2rem] bg-gradient-to-br from-amber-600 via-amber-500 to-orange-500 p-6 sm:p-8 text-white shadow-lg transition-transform hover:scale-[1.01] active:scale-[0.98]"
            >
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5" />
              <div className="relative flex items-center gap-4 sm:gap-6">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur sm:h-20 sm:w-20 sm:rounded-[2rem]">
                  <Banknote className="h-8 w-8 sm:h-10 sm:w-10" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-100 sm:text-xs">Fitur Ekonomi</p>
                  <h2 className="mt-0.5 text-xl font-black sm:mt-1 sm:text-2xl">Ekonomi Syariah</h2>
                  <p className="mt-1 hidden text-xs leading-relaxed text-amber-50 sm:block sm:text-sm">
                    Marketplace, Wallet, dan Infaq.
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </section>

        {/* Dakwah Feed */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-950">Kajian & Artikel</h3>
            <Link href="/dakwah" className="text-sm font-bold text-emerald-700">Lainnya</Link>
          </div>
          <div className="space-y-3">
            {feeds.slice(0, 2).map(feed => (
              <FeedCard key={feed.id} feed={feed} />
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
