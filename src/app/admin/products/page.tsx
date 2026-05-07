"use client";
import { useState } from "react";
import { AdminShell } from "@/components/AdminShell";

import { PlusCircle, ShoppingBag } from "lucide-react";
import { products } from "@/data/mock";

export default function AdminProductsPage(){
 const [show,setShow]=useState(false);
 return <AdminShell active="/admin/products">
  <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-2xl font-black text-slate-900">Kelola Produk</h2><p className="text-sm text-slate-500">Input produk seller, kategori, harga, stok, dan status tayang.</p></div><button onClick={()=>setShow(!show)} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white"><PlusCircle className="h-4 w-4"/>Tambah Produk</button></div>
  {show&&<section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="mb-4 text-lg font-bold">Form Produk Baru</h3><form className="space-y-4" onSubmit={(e)=>{e.preventDefault();alert('Produk disimpan (Mock)');setShow(false)}}><div className="grid gap-4 sm:grid-cols-2"><input required placeholder="Nama produk" className="rounded-xl border bg-slate-50 px-3 py-3 text-sm"/><input required placeholder="Nama seller/toko" className="rounded-xl border bg-slate-50 px-3 py-3 text-sm"/><select className="rounded-xl border bg-slate-50 px-3 py-3 text-sm"><option>Makanan</option><option>Produk Muslim</option><option>Jasa</option></select><input required type="number" placeholder="Harga" className="rounded-xl border bg-slate-50 px-3 py-3 text-sm"/><input type="number" placeholder="Stok" className="rounded-xl border bg-slate-50 px-3 py-3 text-sm"/><select className="rounded-xl border bg-slate-50 px-3 py-3 text-sm"><option>Draft</option><option>Tayang</option><option>Nonaktif</option></select></div><textarea placeholder="Deskripsi produk" className="min-h-24 w-full rounded-xl border bg-slate-50 px-3 py-3 text-sm"></textarea><div className="flex justify-end gap-3"><button type="button" onClick={()=>setShow(false)} className="rounded-xl border px-4 py-2 font-bold">Batal</button><button className="rounded-xl bg-slate-900 px-4 py-2 font-bold text-white">Simpan Produk</button></div></form></section>}
  <section className="rounded-2xl border bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="bg-slate-50 text-slate-500"><th className="p-4">Produk</th><th className="p-4">Kategori</th><th className="p-4">Harga</th><th className="p-4">Status</th></tr></thead><tbody className="divide-y">{products.map(p=><tr key={p.id}><td className="p-4 font-bold text-slate-900">{p.name}</td><td className="p-4">{p.category}</td><td className="p-4 font-bold">{p.price}</td><td className="p-4"><span className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">Tayang</span></td></tr>)}</tbody></table></div></section>
 </AdminShell>
}
