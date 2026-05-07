"use client";

import { useState } from "react";
import { Activity, CheckCircle2, Ticket } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";

export default function TestKesehatanPage() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [queueNumber, setQueueNumber] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Generate a random queue number between A-001 and A-099
    const randomNum = Math.floor(Math.random() * 99) + 1;
    const formattedNum = `A-${randomNum.toString().padStart(3, "0")}`;
    setQueueNumber(formattedNum);
    setIsSubmitted(true);
  };

  return (
    <AppShell active="/test-kesehatan">
      <PageHeader eyebrow="Layanan Klinik Masjid" title="Test Kesehatan" />
      
      {!isSubmitted ? (
        <section className="mx-auto max-w-2xl rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-100 lg:p-8">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <Activity className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-black text-slate-950">Formulir Pendaftaran</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Silakan isi data diri untuk mengambil nomor antrian pemeriksaan kesehatan di klinik atau posko kesehatan masjid.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-900">Nama Lengkap</label>
              <input required type="text" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500" placeholder="Masukkan nama lengkap pasien" />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-900">Usia</label>
                <input required type="number" min="1" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500" placeholder="Misal: 45" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-900">Jenis Kelamin</label>
                <select required className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500">
                  <option value="">Pilih</option>
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-900">Pilihan Cek Kesehatan</label>
              <select required className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500">
                <option value="">Pilih jenis pemeriksaan</option>
                <option value="umum">Pemeriksaan Umum (Tensi, Suhu)</option>
                <option value="darah">Cek Gula Darah & Asam Urat</option>
                <option value="kolesterol">Cek Kolesterol</option>
                <option value="lengkap">Paket Pemeriksaan Lengkap</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-900">Keluhan (Opsional)</label>
              <textarea className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500" placeholder="Tuliskan keluhan jika ada..."></textarea>
            </div>

            <button type="submit" className="mt-4 w-full rounded-2xl bg-emerald-700 px-4 py-4 font-black text-white hover:bg-emerald-800 active:bg-emerald-900 transition-colors">
              Ambil Nomor Antrian
            </button>
          </form>
        </section>
      ) : (
        <section className="mx-auto max-w-md rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-100">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h2 className="text-2xl font-black text-slate-950">Pendaftaran Berhasil!</h2>
          <p className="mt-2 text-sm text-slate-600">
            Silakan tunjukkan nomor antrian ini kepada petugas klinik masjid saat dipanggil.
          </p>

          <div className="mt-8 rounded-3xl border-2 border-dashed border-emerald-200 bg-emerald-50 p-6">
            <p className="text-sm font-bold tracking-widest text-emerald-800 uppercase">NOMOR ANTRIAN</p>
            <div className="mt-2 flex items-center justify-center gap-3 text-emerald-950">
              <Ticket className="h-8 w-8 text-emerald-600" />
              <span className="text-5xl font-black tracking-tight">{queueNumber}</span>
            </div>
            <p className="mt-4 text-xs font-semibold text-emerald-700">Estimasi waktu panggil: 15-20 menit</p>
          </div>

          <button 
            onClick={() => setIsSubmitted(false)}
            className="mt-8 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Daftar Pasien Lain
          </button>
        </section>
      )}
    </AppShell>
  );
}
