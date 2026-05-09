"use client";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { TrendingUp, Users, Target, Calendar, DollarSign, CheckCircle2 } from "lucide-react";

const campaigns = [
  {
    id: 1,
    nama: "Warung Kopi Jamaah Ibu Siti",
    kategori: "UMKM",
    target: 50000000,
    terkumpul: 35000000,
    investor: 127,
    deadline: "30 hari lagi",
    roi: "15% per tahun",
    status: "Aktif",
    deskripsi: "Pengembangan warung kopi dengan konsep syariah di area masjid. Dana untuk renovasi dan penambahan menu.",
    image: "/api/placeholder/400/200",
    verified: true,
  },
  {
    id: 2,
    nama: "Toko Kelontong Pak Ahmad",
    kategori: "Retail",
    target: 30000000,
    terkumpul: 28500000,
    investor: 89,
    deadline: "15 hari lagi",
    roi: "12% per tahun",
    status: "Hampir Tercapai",
    deskripsi: "Ekspansi toko kelontong dengan sistem bagi hasil syariah. Dana untuk stok barang dan renovasi.",
    image: "/api/placeholder/400/200",
    verified: true,
  },
  {
    id: 3,
    nama: "Catering Sehat Bu Aminah",
    kategori: "Kuliner",
    target: 25000000,
    terkumpul: 8500000,
    investor: 34,
    deadline: "45 hari lagi",
    roi: "18% per tahun",
    status: "Baru Dimulai",
    deskripsi: "Usaha catering makanan sehat dan halal untuk acara masjid dan kantor. Dana untuk peralatan dapur.",
    image: "/api/placeholder/400/200",
    verified: true,
  },
];

const formatRupiah = (angka: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(angka);
};

const hitungProgress = (terkumpul: number, target: number) => {
  return Math.round((terkumpul / target) * 100);
};

export default function CrowdfundingPage() {
  return (
    <AppShell active="/crowdfunding">
      <PageHeader 
        eyebrow="Muamalah" 
        title="Crowdfunding Bisnis" 
      />

      {/* Banner Info */}
      <section className="mb-8 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-black">💰 Investasi Syariah Terpercaya</h2>
            <p className="mt-1 text-purple-100 text-sm">Sistem bagi hasil sesuai prinsip syariah, transparan & aman</p>
          </div>
          <button className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-purple-600 hover:bg-purple-50 transition">
            Pelajari Lebih Lanjut
          </button>
        </div>
      </section>

      {/* Stats */}
      <section className="mb-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Kampanye", value: "24", icon: Target },
          { label: "Dana Tersalurkan", value: "Rp 1,2M", icon: DollarSign },
          { label: "Investor Aktif", value: "450+", icon: Users },
          { label: "Sukses Rate", value: "92%", icon: TrendingUp },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <Icon className="h-5 w-5 text-purple-600 mb-2" />
            <p className="text-xl font-black text-slate-900">{value}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </section>

      {/* Campaign List */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Kampanye Aktif</h2>
          <select className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-600">
            <option>Semua Kategori</option>
            <option>UMKM</option>
            <option>Retail</option>
            <option>Kuliner</option>
          </select>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => {
            const progress = hitungProgress(c.terkumpul, c.target);
            return (
              <div key={c.id} className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 overflow-hidden hover:shadow-md transition">
                {/* Image */}
                <div className="relative bg-slate-100 h-40 flex items-center justify-center">
                  <span className="text-slate-400 text-sm">Gambar Usaha</span>
                  {c.verified && (
                    <span className="absolute top-3 right-3 rounded-full bg-green-500 p-1.5">
                      <CheckCircle2 className="h-3 w-3 text-white" />
                    </span>
                  )}
                  <span className="absolute top-3 left-3 rounded-full bg-purple-600 px-3 py-1 text-xs font-bold text-white">
                    {c.kategori}
                  </span>
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="font-bold text-slate-900">{c.nama}</h3>
                  <p className="mt-1 text-xs text-slate-500 line-clamp-2">{c.deskripsi}</p>

                  {/* Progress Bar */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-purple-700">{progress}% tercapai</span>
                      <span className="text-slate-500">{c.deadline}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-slate-500">Terkumpul</p>
                      <p className="text-sm font-bold text-slate-900">{formatRupiah(c.terkumpul)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Target</p>
                      <p className="text-sm font-bold text-slate-900">{formatRupiah(c.target)}</p>
                    </div>
                  </div>

                  {/* ROI & Investor */}
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-green-600 font-bold">
                      <TrendingUp className="h-3 w-3" /> {c.roi}
                    </span>
                    <span className="flex items-center gap-1 text-slate-500">
                      <Users className="h-3 w-3" /> {c.investor} investor
                    </span>
                  </div>

                  {/* CTA */}
                  <button className="mt-4 w-full rounded-xl bg-purple-600 py-2.5 text-sm font-bold text-white hover:bg-purple-700 transition">
                    Investasi Sekarang
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="mt-8 rounded-2xl bg-slate-50 p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Cara Kerja Crowdfunding Syariah</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { step: "1", title: "Pilih Kampanye", desc: "Pilih usaha jamaah yang ingin Anda danai" },
            { step: "2", title: "Investasi", desc: "Tentukan nominal investasi sesuai kemampuan" },
            { step: "3", title: "Bagi Hasil", desc: "Terima bagi hasil sesuai akad syariah" },
          ].map((item) => (
            <div key={item.step} className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-600 text-sm font-black text-white">
                {item.step}
              </div>
              <div>
                <p className="font-bold text-slate-900">{item.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
