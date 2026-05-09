"use client";
import { useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { PlusCircle, Calendar, MapPin, Users, Edit2, Trash2 } from "lucide-react";
import { events } from "@/data/mock";

export default function AdminEventsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <AdminShell active="/admin/events">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Kelola Event</h2>
          <p className="text-sm text-slate-500">Tambah, edit, dan kelola acara masjid</p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
          }}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white hover:bg-emerald-700 transition"
        >
          <PlusCircle className="h-4 w-4" />
          Tambah Event
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-lg font-bold">
            {editingId ? "Edit Event" : "Form Event Baru"}
          </h3>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              alert(editingId ? "Event diupdate (Mock)" : "Event disimpan (Mock)");
              setShowForm(false);
              setEditingId(null);
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                required
                placeholder="Judul event"
                className="rounded-xl border bg-slate-50 px-3 py-3 text-sm"
              />
              <select className="rounded-xl border bg-slate-50 px-3 py-3 text-sm">
                <option>Kajian</option>
                <option>Sosial</option>
                <option>Edukasi</option>
                <option>Kesehatan</option>
              </select>
              <input
                required
                type="date"
                placeholder="Tanggal"
                className="rounded-xl border bg-slate-50 px-3 py-3 text-sm"
              />
              <input
                required
                type="time"
                placeholder="Waktu"
                className="rounded-xl border bg-slate-50 px-3 py-3 text-sm"
              />
              <input
                required
                placeholder="Lokasi"
                className="rounded-xl border bg-slate-50 px-3 py-3 text-sm"
              />
              <input
                required
                placeholder="Pembicara/PIC"
                className="rounded-xl border bg-slate-50 px-3 py-3 text-sm"
              />
              <select className="rounded-xl border bg-slate-50 px-3 py-3 text-sm">
                <option>Draft</option>
                <option>Aktif</option>
                <option>Selesai</option>
              </select>
              <input
                type="number"
                placeholder="Kuota peserta (opsional)"
                className="rounded-xl border bg-slate-50 px-3 py-3 text-sm"
              />
            </div>
            <textarea
              placeholder="Deskripsi event"
              className="min-h-24 w-full rounded-xl border bg-slate-50 px-3 py-3 text-sm"
            ></textarea>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
                className="rounded-xl border px-4 py-2 font-bold hover:bg-slate-50 transition"
              >
                Batal
              </button>
              <button className="rounded-xl bg-slate-900 px-4 py-2 font-bold text-white hover:bg-slate-800 transition">
                {editingId ? "Update Event" : "Simpan Event"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Table */}
      <section className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500">
                <th className="p-4 font-semibold">Event</th>
                <th className="p-4 font-semibold">Tanggal & Waktu</th>
                <th className="p-4 font-semibold">Lokasi</th>
                <th className="p-4 font-semibold">Kategori</th>
                <th className="p-4 font-semibold">Pendaftar</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {events.map((evt) => (
                <tr key={evt.id} className="hover:bg-slate-50">
                  <td className="p-4">
                    <p className="font-bold text-slate-900">{evt.title}</p>
                    <p className="text-xs text-slate-500">{evt.speaker}</p>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Calendar className="h-3.5 w-3.5" />
                      <span className="text-xs">{evt.date}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{evt.time}</p>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <MapPin className="h-3.5 w-3.5" />
                      <span className="text-xs">{evt.location}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">
                      {evt.category}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Users className="h-3.5 w-3.5" />
                      <span className="text-xs font-bold">{evt.registrants}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span
                      className={`rounded-lg px-2 py-1 text-xs font-bold ${
                        evt.status === "Aktif"
                          ? "bg-emerald-50 text-emerald-700"
                          : evt.status === "Draft"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {evt.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingId(evt.id);
                          setShowForm(true);
                        }}
                        className="rounded-lg p-2 text-blue-600 hover:bg-blue-50 transition"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Hapus event "${evt.title}"?`)) {
                            alert("Event dihapus (Mock)");
                          }
                        }}
                        className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 transition"
                        title="Hapus"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Stats */}
      <section className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500">Total Event</p>
          <p className="text-2xl font-black text-slate-900">{events.length}</p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500">Event Aktif</p>
          <p className="text-2xl font-black text-emerald-600">
            {events.filter((e) => e.status === "Aktif").length}
          </p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500">Total Pendaftar</p>
          <p className="text-2xl font-black text-blue-600">
            {events.reduce((sum, e) => sum + e.registrants, 0)}
          </p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500">Event Selesai</p>
          <p className="text-2xl font-black text-slate-400">
            {events.filter((e) => e.status === "Selesai").length}
          </p>
        </div>
      </section>
    </AdminShell>
  );
}
