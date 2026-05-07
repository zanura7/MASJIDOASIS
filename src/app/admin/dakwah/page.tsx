"use client";
import { useState } from "react";
import { BookOpen, PlusCircle } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { feeds } from "@/data/mock";

export default function AdminDakwahPage() {
  const [showForm, setShowForm] = useState(false);

  return (
    <AdminShell active="/admin/dakwah">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Kelola Media Dakwah</h2>
          <p className="text-sm text-slate-500">Buat dan kelola postingan kajian, video, atau artikel.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white hover:bg-emerald-700">
          <PlusCircle className="h-4 w-4" />
          Buat Postingan
        </button>
      </div>

      {showForm && (
        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-bold text-slate-900">Form Postingan Baru</h3>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); alert('Postingan disimpan (Mock)'); setShowForm(false); }}>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Judul Konten</label>
              <input required type="text" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" placeholder="Misal: Keutamaan Sedekah Subuh" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Tipe Konten</label>
                <select required className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500">
                  <option value="Artikel">Artikel</option>
                  <option value="Video">Video</option>
                  <option value="Kajian">Jadwal Kajian</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Narasumber / Penulis</label>
                <input required type="text" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" placeholder="Misal: Ust. Ahmad" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Isi Konten / Link Video</label>
              <textarea required className="min-h-[120px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" placeholder="Tuliskan isi artikel atau link youtube disini..."></textarea>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50">Batal</button>
              <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 font-bold text-white hover:bg-slate-800">Terbitkan</button>
            </div>
          </form>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {feeds.map(feed => (
          <div key={feed.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="mb-2 inline-block rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 uppercase">{feed.type}</span>
            <h4 className="font-bold text-slate-900 leading-snug">{feed.title}</h4>
            <p className="mt-2 text-sm text-slate-500">{feed.speaker}</p>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
