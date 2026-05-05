import { Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ProductCard } from "@/components/Cards";
import { PageHeader } from "@/components/PageHeader";
import { categories, products } from "@/data/mock";

export default function MarketplacePage() { return <AppShell active="/marketplace"><PageHeader eyebrow="Marketplace Jamaah" title="Belanja Produk Halal" /><section className="mb-6 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100"><div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3"><Search className="h-5 w-5 text-slate-400" /><span className="text-sm text-slate-400">Cari produk, seller, atau kategori...</span></div><div className="mt-4 flex flex-wrap gap-2">{categories.map(category => <span key={category} className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">{category}</span>)}</div></section><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{products.map(product => <ProductCard key={product.id} product={product} />)}</section></AppShell>; }
