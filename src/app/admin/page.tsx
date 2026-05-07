import { AlertCircle, CheckCircle2, Clock, Users, Wallet } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { orders, walletTransactions, ustadzQuestions } from "@/data/mock";

export default function AdminDashboardPage() {
  return (
    <AdminShell active="/admin">
      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Users className="h-5 w-5" /></div>
          <p className="text-xs font-semibold text-slate-500">Total Jamaah</p>
          <p className="mt-1 text-2xl font-black text-slate-900">1,248</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Wallet className="h-5 w-5" /></div>
          <p className="text-xs font-semibold text-slate-500">Dana Escrow</p>
          <p className="mt-1 text-2xl font-black text-slate-900">Rp 8.4M</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><Clock className="h-5 w-5" /></div>
          <p className="text-xs font-semibold text-slate-500">Pesanan Diproses</p>
          <p className="mt-1 text-2xl font-black text-slate-900">32</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600"><AlertCircle className="h-5 w-5" /></div>
          <p className="text-xs font-semibold text-slate-500">Menunggu Ustadz</p>
          <p className="mt-1 text-2xl font-black text-slate-900">14</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Recent Orders */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h3 className="font-black text-slate-900">Pesanan Terbaru</h3>
          </div>
          <div className="p-2">
            {orders.map(order => (
              <div key={order.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl">
                <div>
                  <p className="text-sm font-bold text-slate-900">{order.id}</p>
                  <p className="text-xs text-slate-500">{order.title} • {order.amount}</p>
                </div>
                <span className={`rounded-lg px-2.5 py-1 text-[10px] font-bold ${order.status === 'Selesai' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {order.status}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-100 p-3 text-center">
            <a href="/admin/orders" className="text-xs font-bold text-emerald-600 hover:text-emerald-700">Lihat Semua Pesanan</a>
          </div>
        </section>

        {/* Recent QnA */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h3 className="font-black text-slate-900">Moderasi Q&A</h3>
          </div>
          <div className="p-2">
            {ustadzQuestions.map(q => (
              <div key={q.id} className="p-3 hover:bg-slate-50 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${q.status === 'Dijawab' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                    {q.status}
                  </span>
                  <p className="text-xs font-semibold text-slate-500">{q.category}</p>
                </div>
                <p className="text-sm font-bold text-slate-900">{q.question}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-100 p-3 text-center">
            <a href="/admin/qna" className="text-xs font-bold text-emerald-600 hover:text-emerald-700">Moderasi Semua Pertanyaan</a>
          </div>
        </section>

        {/* Escrow/Wallet Ledger */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-2">
          <div className="border-b border-slate-100 p-5 flex items-center justify-between">
            <h3 className="font-black text-slate-900">Mutasi Rekber & Wallet</h3>
            <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">Download Laporan</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500">
                  <th className="p-4 font-semibold">ID</th>
                  <th className="p-4 font-semibold">Tipe</th>
                  <th className="p-4 font-semibold">Nominal</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {walletTransactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50">
                    <td className="p-4 font-medium text-slate-900">{tx.id}</td>
                    <td className="p-4 text-slate-600">{tx.type}</td>
                    <td className={`p-4 font-bold ${tx.amount.startsWith('+') ? 'text-emerald-600' : 'text-slate-900'}`}>{tx.amount}</td>
                    <td className="p-4">
                      <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{tx.status}</span>
                    </td>
                    <td className="p-4 text-slate-500">{tx.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
