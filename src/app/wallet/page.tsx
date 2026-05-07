import { ArrowDownCircle, ArrowUpCircle, ShieldCheck, Wallet } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { profile, walletTransactions } from "@/data/mock";

export default function WalletPage() {
  return <AppShell active="/wallet"><PageHeader eyebrow="Wallet Jamaah" title="Saldo & Ledger" wallet={profile.wallet} />
    <section className="mb-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-[2rem] bg-gradient-to-r from-emerald-800 to-lime-700 p-6 text-white shadow-lg">
        <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-emerald-100">Saldo tersedia</p><h2 className="mt-2 text-4xl font-black">{profile.wallet}</h2><p className="mt-3 text-sm leading-6 text-emerald-50">Dana wallet digunakan untuk belanja, infaq, dan refund transaksi. Semua mutasi akan tercatat di ledger.</p></div><div className="rounded-3xl bg-white/15 p-4"><Wallet className="h-10 w-10" /></div></div>
        <div className="mt-6 flex flex-wrap gap-3"><button className="rounded-2xl bg-white px-5 py-3 font-black text-emerald-800">Top Up</button><button className="rounded-2xl border border-white/30 px-5 py-3 font-black">Tarik Dana</button></div>
      </div>
      <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-100"><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><ShieldCheck className="h-6 w-6" /></div><h3 className="text-xl font-black text-slate-950">Rekber Amanah</h3><p className="mt-2 text-sm leading-6 text-slate-600">Dana order marketplace ditahan sebagai escrow sampai pesanan selesai atau admin release.</p></div>
    </section>
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100"><h3 className="mb-4 text-xl font-black text-slate-950">Mutasi Wallet</h3><div className="space-y-3">{walletTransactions.map(tx => <div key={tx.id} className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4"><div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tx.amount.startsWith('+') ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{tx.amount.startsWith('+') ? <ArrowDownCircle className="h-5 w-5" /> : <ArrowUpCircle className="h-5 w-5" />}</div><div className="flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold text-slate-900">{tx.type}</p><p className="font-black text-slate-950">{tx.amount}</p></div><p className="text-sm text-slate-500">{tx.id} • {tx.date} • {tx.status}</p><p className="mt-1 text-sm text-slate-600">{tx.note}</p></div></div>)}</div></section>
  </AppShell>;
}
