"use client";
import { useState } from "react";
import { PlusCircle, Search, UserPlus } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";

export default function AdminUsersPage() {
  const [showForm, setShowForm] = useState(false);

  return (
    <AdminShell active="/admin/users">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Kelola Data Pengguna</h2>
          <p className="text-sm text-slate-500">Database Jamaah, Penjual, Ustadz, dan Dokter.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white hover:bg-emerald-700">
          <UserPlus className="h-4 w-4" />
          Tambah Pengguna
        </button>
      </div>

      {showForm && (
        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-bold text-slate-900">Form Input Pengguna Baru</h3>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); alert('Data tersimpan (Mock)'); setShowForm(false); }}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Nama Lengkap</label>
                <input required type="text" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" placeholder="Nama pengguna" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Role / Peran</label>
                <select required className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500">
                  <option value="jamaah">Jamaah (Pembeli)</option>
                  <option value="penjual">Penjual / Toko</option>
                  <option value="ustadz">Ustadz (Q&A)</option>
                  <option value="dokter">Dokter (Kesehatan)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">No. WhatsApp</label>
                <input required type="text" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" placeholder="0812..." />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Email (Opsional)</label>
                <input type="email" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" placeholder="email@domain.com" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50">Batal</button>
              <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 font-bold text-white hover:bg-slate-800">Simpan Data</button>
            </div>
          </form>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4">
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 w-full max-w-sm">
            <Search className="h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Cari nama atau role..." className="bg-transparent text-sm outline-none w-full" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500">
                <th className="p-4 font-semibold">Nama</th>
                <th className="p-4 font-semibold">Role</th>
                <th className="p-4 font-semibold">Kontak</th>
                <th className="p-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50">
                <td className="p-4 font-bold text-slate-900">Adi Wardana</td>
                <td className="p-4"><span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">Jamaah</span></td>
                <td className="p-4 text-slate-600">08123456789</td>
                <td className="p-4"><span className="text-emerald-600 font-semibold text-xs">Aktif</span></td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="p-4 font-bold text-slate-900">Toko Barokah</td>
                <td className="p-4"><span className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">Penjual</span></td>
                <td className="p-4 text-slate-600">08567778889</td>
                <td className="p-4"><span className="text-emerald-600 font-semibold text-xs">Aktif</span></td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="p-4 font-bold text-slate-900">dr. Faisal</td>
                <td className="p-4"><span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">Dokter</span></td>
                <td className="p-4 text-slate-600">08112223334</td>
                <td className="p-4"><span className="text-emerald-600 font-semibold text-xs">Aktif</span></td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="p-4 font-bold text-slate-900">Ust. Rahman</td>
                <td className="p-4"><span className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">Ustadz</span></td>
                <td className="p-4 text-slate-600">08198887776</td>
                <td className="p-4"><span className="text-emerald-600 font-semibold text-xs">Aktif</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
