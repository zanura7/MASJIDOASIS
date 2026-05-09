"use client";
import { useState } from "react";
import { BookOpen, Play, Clock3, ChevronRight, Search, MessageCircleHeart } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { feeds } from "@/data/mock";

const allFeeds = feeds;

const extraFeeds = [
  { id: "feed-4", type: "Video", title: "Cara Mudah Hisab Zakat Penghasilan", time: "22 menit", speaker: "Ust. Ahmad Fauzi" },
  { id: "feed-5", type: "Kajian", title: "Keistimewaan 10 Hari Pertama Dzulhijjah", time: "15 menit baca", speaker: "Ust. Rahman" },
  { id: "feed-6", type: "Artikel", title: "Panduan Sholat Gerhana Bulan", time: "7 menit baca", speaker: "Tim Dakwah" },
  { id: "feed-7", type: "Video", title: "Tanya Jawab: Hukum Jual Beli Kredit", time: "31 menit", speaker: "Ust. Ahmad Fauzi" },
  { id: "feed-8", type: "Kajian", title: "Adab Terhadap Tetangga", time: "12 menit baca", speaker: "Ust. Rahman" },
];

const categories = ["Semua", "Kajian", "Video", "Artikel"];

export default function DakwahPage() {
  const [activeTab, setActiveTab] = useState("Semua");
  const [searchQuery, setSearchQuery] = useState("");

  const displayedFeeds = [...allFeeds, ...extraFeeds];

  const filtered = displayedFeeds.filter(f => {
    const matchType = activeTab === "Semua" || f.type === activeTab;
    const matchSearch = f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        f.speaker.toLowerCase().includes(searchQuery.toLowerCase());
    return matchType && matchSearch;
  });

  return (
    <AppShell active="/dakwah">
      <PageHeader eyebrow="Media Dakwah" title="Kajian & Artikel Islami" />

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Cari kajian, artikel, atau ustadz..."
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

      {/* Feed Grid */}
      {filtered.length === 0 ? (
        <section className="rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-100">
          <BookOpen className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-lg font-bold text-slate-500">Kontak tidak ditemukan</p>
          <p className="text-sm text-slate-400">Coba ganti kata kunci atau pilih kategori lain.</p>
        </section>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2">
          {filtered.map(feed => (
            <article
              key={feed.id}
              className="group relative cursor-pointer rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-100 transition hover:shadow-md hover:ring-emerald-200 active:scale-[0.99]"
            >
              {/* Type Badge */}
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                feed.type === "Video"
                  ? "bg-rose-50 text-rose-700"
                  : feed.type === "Kajian"
                  ? "bg-indigo-50 text-indigo-700"
                  : "bg-amber-50 text-amber-700"
              }`}>
                {feed.type === "Video" ? <Play className="h-3 w-3" /> : <BookOpen className="h-3 w-3" />}
                {feed.type}
              </span>

              <h3 className="mt-3 text-lg font-black text-slate-950 group-hover:text-emerald-700 transition-colors">
                {feed.title}
              </h3>

              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-slate-500">{feed.speaker}</span>
                <span className="flex items-center gap-1 text-slate-400">
                  <Clock3 className="h-3.5 w-3.5" />
                  {feed.time}
                </span>
              </div>

              <div className="mt-4 flex items-center gap-1 text-sm font-bold text-emerald-700 opacity-0 transition group-hover:opacity-100">
                Baca <ChevronRight className="h-4 w-4" />
              </div>
            </article>
          ))}
        </section>
      )}

      {/* Tanya Ustadz CTA */}
      <section className="mt-8 rounded-[2rem] bg-gradient-to-br from-emerald-800 to-lime-700 p-6 text-white shadow-lg">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20">
            <MessageCircleHeart className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-black">Ada pertanyaan agama?</h3>
            <p className="mt-1 text-sm leading-relaxed text-emerald-100">
              Konsultasi gratis dengan ustadz atau dokter melalui fitur Tanya Ustadz.
            </p>
          </div>
        </div>
        <a
          href="/tanya-ustadz"
          className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-emerald-800 transition hover:bg-emerald-50"
        >
          Tanya Sekarang
        </a>
      </section>
    </AppShell>
  );
}
