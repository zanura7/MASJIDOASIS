"use client";

import { useState } from "react";
import { CheckCircle2, Store, UserRound } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { profile } from "@/data/mock";

export default function ProfilePage() {
  const [showSellerForm, setShowSellerForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  return (
    <AppShell active="/profile">
      <PageHeader eyebrow="Profil Jamaah" title="Akun Saya" wallet={profile.wallet} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:p-6">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-700">
                <UserRound className="h-10 w-10" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-950">{profile.name}</h2>
                <p className="font-semibold text-emerald-700">{profile.role}</p>
              </div>
            </div>

            <button
              onClick={() => setShowSellerForm(true)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-sm shadow-emerald-100 transition hover:bg-emerald-700 sm:w-auto"
            >
              <Store className="h-5 w-5" />
              Daftar Jadi Seller
            </button>
          </div>

          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-slate-500">Nomor HP</p>
              <p className="font-bold text-slate-900">{profile.phone}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-slate-500">Email</p>
              <p className="font-bold text-slate-900 break-all">{profile.email}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 sm:col-span-2">
              <p className="text-slate-500">Alamat</p>
              <p className="font-bold text-slate-900">{profile.address}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-4 sm:col-span-2">
              <p className="text-emerald-700">Saldo Wallet</p>
              <p className="text-xl font-black text-emerald-800">{profile.wallet}</p>
            </div>
          </div>
        </section>

        <aside className="rounded-3xl border border-amber-100 bg-amber-50 p-5 shadow-sm">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-amber-600 shadow-sm">
            <Store className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-black text-slate-900">Buka Lapak di Marketplace</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Jamaah bisa mendaftar sebagai seller untuk menjual produk halal, jasa komunitas, atau kebutuhan masjid.
          </p>
          <ul className="mt-4 space-y-2 text-sm font-semibold text-slate-700">
            <li className="flex gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /> Verifikasi toko oleh admin</li>
            <li className="flex gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /> Pembayaran aman via rekber</li>
            <li className="flex gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /> Kelola produk dan pesanan</li>
          </ul>
        </aside>
      </div>

      {showSellerForm && (
        <section className="mt-5 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:p-6">
          <div className="mb-5">
            <h3 className="text-xl font-black text-slate-950">Form Daftar Seller</h3>
            <p className="text-sm text-slate-500">Lengkapi data toko untuk diajukan ke admin.</p>
          </div>

          {submitted ? (
            <div className="rounded-2xl bg-emerald-50 p-5 text-emerald-800">
              <p className="font-black">Pengajuan seller berhasil dikirim.</p>
              <p className="mt-1 text-sm">Status: Menunggu verifikasi admin. Setelah disetujui, menu seller dashboard akan aktif.</p>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                setSubmitted(true);
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-bold text-slate-700">Nama Toko</label>
                  <input required className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" placeholder="Contoh: Toko Barokah" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-bold text-slate-700">Kategori Usaha</label>
                  <select required className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500">
                    <option>Makanan & Minuman</option>
                    <option>Produk Muslim</option>
                    <option>Jasa Komunitas</option>
                    <option>Donasi Barang</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">Alamat Toko / Area Layanan</label>
                <textarea required className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" placeholder="Alamat atau area layanan toko"></textarea>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setShowSellerForm(false)} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-50">
                  Batal
                </button>
                <button type="submit" className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white hover:bg-slate-800">
                  Kirim Pengajuan Seller
                </button>
              </div>
            </form>
          )}
        </section>
      )}
    </AppShell>
  );
}
