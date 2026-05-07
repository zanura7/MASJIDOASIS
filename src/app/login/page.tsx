import Link from "next/link";
import { ArrowRight, ShieldCheck, Smartphone } from "lucide-react";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#d1fae5,transparent_35%),linear-gradient(135deg,#f8fafc,#ecfdf5)] px-4 py-8 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-emerald-100 ring-1 ring-emerald-100 lg:grid-cols-[1fr_420px]">
          <section className="hidden bg-emerald-700 p-10 text-white lg:block">
            <div className="flex h-full flex-col justify-between">
              <div>
                <div className="mb-10 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-xl font-black">MO</div>
                <h1 className="text-4xl font-black leading-tight">Masjid Oasis</h1>
                <p className="mt-4 max-w-sm text-sm leading-6 text-emerald-50">
                  Login jamaah menggunakan OTP nomor HP untuk akses marketplace, wallet, infaq, dakwah, dan layanan komunitas.
                </p>
              </div>
              <div className="rounded-3xl bg-white/10 p-5 backdrop-blur">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <p className="text-sm font-bold">Prototype UI</p>
                <p className="mt-1 text-xs leading-5 text-emerald-50">Form ini mockup frontend. Integrasi OTP asli akan disambungkan saat backend Go/API sudah dibuat.</p>
              </div>
            </div>
          </section>

          <section className="p-6 sm:p-8 lg:p-10">
            <Link href="/" className="mb-8 inline-flex items-center text-sm font-bold text-emerald-700 hover:text-emerald-800">
              ← Kembali ke Dashboard
            </Link>

            <div className="mb-8">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 lg:hidden">
                <Smartphone className="h-7 w-7" />
              </div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-600">Login Jamaah</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Masuk dengan nomor HP</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">Masukkan nomor WhatsApp/HP aktif. Sistem akan mengirim kode OTP saat backend sudah aktif.</p>
            </div>

            <form className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Nomor HP / WhatsApp</label>
                <input
                  type="tel"
                  placeholder="08xxxxxxxxxx"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                />
              </div>
              <button type="button" className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-100 hover:bg-emerald-700">
                Kirim Kode OTP
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-500">
              Belum punya akun? Masukkan nomor HP saja, akun jamaah akan dibuat otomatis setelah verifikasi OTP pada versi backend.
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
