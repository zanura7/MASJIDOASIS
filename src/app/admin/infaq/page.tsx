"use client";
import { useState } from "react";
import { HeartHandshake, PlusCircle } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { campaigns } from "@/data/mock";

export default function AdminInfaqPage() {
  const [showForm, setShowForm] = useState(false);

  return (
    <AdminShell active="/admin/infaq">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Kelola Campaign Donasi</h2>
          <p className="text-sm text-slate-500">Buat dan pantau penggalangan dana infaq/shadaqah.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white hover:bg-emerald-700">
          <PlusCircle className="h-4 w-4" />
          Buat Campaign
        </button>
      </div>

      {showForm && (
        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-bold text-slate-900">Form Campaign Baru</h3>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); alert('Campaign disimpan (Mock)'); setShowForm(false); }}>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Judul Campaign</label>
              <input required type="text" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" placeholder="Misal: Pembangunan Area Wudhu" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Target Dana (Rp)</label>
                <input required type="number" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" placeholder="50000000" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Batas Waktu (Opsional)</label>
                <input type="date" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Deskripsi Campaign</label>
              <textarea required className="min-h-[100px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" placeholder="Ceritakan tujuan campaign ini..."></textarea>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50">Batal</button>
              <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 font-bold text-white hover:bg-slate-800">Publish Campaign</button>
            </div>
          </form>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {campaigns.map(camp => (
          <div key={camp.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="mb-2 inline-block rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700 uppercase">Aktif</span>
            <h4 className="font-bold text-slate-900 leading-snug">{camp.title}</h4>
            <div className="mt-4">
              <div className="flex justify-between text-xs mb-1">
                <span className="font-bold text-emerald-600">{camp.collected}</span>
                <span className="text-slate-500">dari {camp.target}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${camp.percent}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
