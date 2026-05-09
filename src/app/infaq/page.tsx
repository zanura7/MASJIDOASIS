"use client";
import { useState } from "react";
import { HeartHandshake, TrendingUp, Users, Target, Search, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { campaigns } from "@/data/mock";

const allCampaigns = [
  ...campaigns,
  { id: "cmp-4", title: "Pembangunan Perpustakaan Masjid", collected: "Rp 12.300.000", target: "Rp 25.000.000", percent: 49 },
  { id: "cmp-5", title: "Bantuan Pendidikan Anak Yatim", collected: "Rp 28.700.000", target: "Rp 40.000.000", percent: 72 },
  { id: "cmp-6", title: "Operasional Dapur Umum Jumat", collected: "Rp 5.100.000", target: "Rp 8.000.000", percent: 64 },
];

const categories = ["Semua", "Masjid", "Sosial", "Pendidikan", "Kesehatan"];

export default function InfaqPage() {
  const [activeTab, setActiveTab] = useState("Semua");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = allCampaigns.filter(c => {
    const matchSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchSearch;
  });

  return (
    <AppShell active="/infaq">
      <PageHeader eyebrow="Infaq & Shadaqah" title="Campaign Kebaikan" />

      {/* Stats Overview */}
      <section className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-[2rem] bg-gradient-to-br from-emerald-600 to-emerald-700 p-5 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
              <HeartHandshake className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-100">Total Campaign</p>
              <p className="mt-1 text-2xl font-black">{allCampaigns.length}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] bg-gradient-to-br from-amber-500 to-amber-600 p-5 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-100">Terkumpul</p>
              <p className="mt-1 text-2xl font-black">Rp 77,6jt</p>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] bg-gradient-to-br from-indigo-500 to-indigo-600 p-5 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-100">Donatur</p>
              <p className="mt-1 text-2xl font-black">1.247</p>
            </div>
          </div>
        </div>
      </section>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Cari campaign infaq atau shadaqah..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full rounded-2xl border border-slate-100 bg-white py-3 pl-11 pr-4 text-sm outline-none shadow-sm transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
        />
      </div>

      {/* Category Tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveTab(cat)}
            className={`shrink-0 rounded-full px-5 py-2 text-sm font-bold transition ${
              activeTab === cat
                ? "bg-emerald-700 text-white shadow-md"
                : "bg-white text-slate-600 shadow-sm ring-1 ring-slate-100 hover:bg-emerald-50 hover:text-emerald-700"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Campaign Grid */}
      {filtered.length === 0 ? (
        <section className="rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-100">
          <Target className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-lg font-bold text-slate-500">Campaign tidak ditemukan</p>
          <p className="text-sm text-slate-400">Coba ganti kata kunci pencarian.</p>
        </section>
      ) : (
        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(campaign => (
            <article
              key={campaign.id}
              className="group cursor-pointer rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-100 transition hover:shadow-md hover:ring-emerald-200 active:scale-[0.99]"
            >
              {/* Progress Badge */}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                <Target className="h-3 w-3" />
                {campaign.percent}% tercapai
              </span>

              <h3 className="mt-4 text-lg font-black text-slate-950 group-hover:text-emerald-700 transition-colors">
                {campaign.title}
              </h3>

              <div className="mt-4 space-y-2">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-slate-500">Terkumpul</span>
                  <span className="font-black text-emerald-700">{campaign.collected}</span>
                </div>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-slate-500">Target</span>
                  <span className="font-bold text-slate-600">{campaign.target}</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-lime-500 transition-all"
                  style={{ width: `${campaign.percent}%` }}
                />
              </div>

              <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-800 active:bg-emerald-900">
                Infaq Sekarang
                <ChevronRight className="h-4 w-4" />
              </button>
            </article>
          ))}
        </section>
      )}

      {/* Info Rekber */}
      <section className="mt-8 rounded-[2rem] bg-gradient-to-br from-indigo-800 to-purple-700 p-6 text-white shadow-lg">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20">
            <HeartHandshake className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-black">Infaq Aman dengan Rekber</h3>
            <p className="mt-2 text-sm leading-relaxed text-indigo-100">
              Semua donasi melalui sistem escrow (rekening bersama) yang dikelola admin masjid. Dana disalurkan transparan sesuai campaign.
            </p>
            <ul className="mt-3 space-y-1 text-sm text-indigo-100">
              <li>• Dana ditahan di wallet escrow sampai campaign selesai</li>
              <li>• Laporan penggunaan dana dipublikasikan berkala</li>
              <li>• Refund otomatis jika campaign dibatalkan</li>
            </ul>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
