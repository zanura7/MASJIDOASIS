"use client";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { BedDouble, MapPin, Star, Users, Shield, Clock } from "lucide-react";
import Link from "next/link";

const paketUmroh = [
  {
    id: 1,
    nama: "Umroh Reguler 9 Hari",
    Durandasi: "9 Hari 8 Malam",
   Hotel: "Hotel Bintang 4",
    lokasi: "Mekkah & Madinah",
    harga: "Rp 28.500.000",
    fasilitas: ["Tiket Pesawat PP", "Hotel Bintang 4", "Makan 3x Sehari", "Transportasi AC", "Tour Leader"],
    rating: 4.8,
    testimonial: "Alhamdulillah menyelami spiritual dengan tenang. Guidena sabar banget.",
    image: "/api/placeholder/400/200",
  },
  {
    id: 2,
    nama: "Umroh Plus Turki 14 Hari",
    Durandasi: "14 Hari 13 Malam",
   Hotel: "Hotel Bintang 5",
    lokasi: "Mekkah, Madinah & Istanbul",
    harga: "Rp 58.000.000",
    fasilitas: ["Tiket Pesawat PP", "Hotel Bintang 5", "Makan 3x Sehari", "Tour Istanbul", "Visa Inclusive"],
    rating: 4.9,
    testimonial: "Kombinasi umroh dan wisata ke Turki, sekali jalan dapat dua!",
    image: "/api/placeholder/400/200",
  },
  {
    id: 3,
    nama: "Umroh Hemat 12 Hari",
    Durandasi: "12 Hari 11 Malam",
    Hotel: "Hotel Bintang 3",
    lokasi: "Mekkah & Madinah",
    harga: "Rp 19.900.000",
    fasilitas: ["Tiket Pesawat PP", "Hotel Bintang 3", "Makan 3x Sehari", "Transportasi AC"],
    rating: 4.6,
    testimonial: "Pilihan paling terjangkau, bintang 3 tapi dekat Masjidil Haram.",
    image: "/api/placeholder/400/200",
  },
];

const paketHaji = [
  {
    id: 1,
    nama: "Paket Haji Plus 2026",
    Durandasi: "40 Hari",
   Hotel: "Hotel Bintang 5 + Arofah",
    lokasi: "Saudi Arabia",
    harga: "Rp 185.000.000",
    fasilitas: ["Visa Haji", "Tiket Pesawat", "Hotel Mewah", "Makan Full Board", "Pendampingan 24/7"],
    rating: 5.0,
    badge: "Kuota Terbatas",
    image: "/api/placeholder/400/200",
  },
];

export default function OTAPage() {
  return (
    <AppShell active="/ota">
      <PageHeader eyebrow="Muamalah" title="Online Travel Agent" />

      {/* Banner */}
      <section className="mb-8 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-black">✈️ Promo Umroh Bulan Ini</h2>
            <p className="mt-1 text-indigo-100 text-sm">Diskon hingga Rp 3jt untuk pendaftar pertama bulan ini</p>
          </div>
          <button className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-indigo-600 hover:bg-indigo-50 transition">
            Hubungi Kami
          </button>
        </div>
      </section>

      {/* Paket Haji */}
      {paketHaji.length > 0 && (
        <section className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            <BedDouble className="h-5 w-5 text-amber-600" />
            <h2 className="text-lg font-bold text-slate-900">Paket Haji</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paketHaji.map((p) => (
              <div key={p.id} className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 overflow-hidden">
                <div className="relative bg-slate-100 h-40 flex items-center justify-center">
                  <span className="text-slate-400 text-sm">Gambar Paket</span>
                  {p.badge && (
                    <span className="absolute top-3 left-3 rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-white">
                      {p.badge}
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-slate-900">{p.nama}</h3>
                      <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {p.Durandasi}</span>
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {p.lokasi}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-amber-500 text-xs font-bold">
                      <Star className="h-3 w-3 fill-current" /> {p.rating}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{p.Hotel}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.fasilitas.slice(0, 3).map((f) => (
                      <span key={f} className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600">{f}</span>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-lg font-black text-indigo-700">{p.harga}</span>
                    <button className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition">
                      Booking
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Paket Umroh */}
      <section className="mb-6">
        <div className="mb-4 flex items-center gap-2">
          <MapPin className="h-5 w-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-slate-900">Paket Umroh</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paketUmroh.map((p) => (
            <div key={p.id} className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 overflow-hidden">
              <div className="relative bg-slate-100 h-40 flex items-center justify-center">
                <span className="text-slate-400 text-sm">Gambar Paket</span>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900">{p.nama}</h3>
                    <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {p.Durandasi}</span>
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {p.lokasi}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-amber-500 text-xs font-bold">
                    <Star className="h-3 w-3 fill-current" /> {p.rating}
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-500">{p.Hotel}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.fasilitas.slice(0, 3).map((f) => (
                    <span key={f} className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600">{f}</span>
                  ))}
                </div>
                <p className="mt-3 text-xs italic text-slate-400">&ldquo;{p.testimonial}&rdquo;</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-lg font-black text-indigo-700">{p.harga}</span>
                  <button className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition">
                    Booking
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Trust badges */}
      <section className="mt-8 grid grid-cols-3 gap-3">
        {[
          { icon: Shield, label: "Izin Resmi", sub: "Kementerian Agama" },
          { icon: Users, label: "5000+ Jamaah", sub: "Telah Berangkat" },
          { icon: Star, label: "Rating 4.9", sub: "Google Review" },
        ].map(({ icon: Icon, label, sub }) => (
          <div key={label} className="rounded-2xl bg-white p-4 text-center shadow-sm ring-1 ring-slate-100">
            <Icon className="mx-auto h-6 w-6 text-indigo-600" />
            <p className="mt-2 text-sm font-bold text-slate-900">{label}</p>
            <p className="text-xs text-slate-500">{sub}</p>
          </div>
        ))}
      </section>
    </AppShell>
  );
}
