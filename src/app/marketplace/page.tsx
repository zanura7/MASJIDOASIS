"use client";
import { useState } from "react";
import { Search, ShoppingBag } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ProductCard } from "@/components/Cards";
import { PageHeader } from "@/components/PageHeader";
import { categories, products } from "@/data/mock";

// Add "Semua" to the start of categories
const allCategories = ["Semua", ...categories];

export default function MarketplacePage() {
  const [activeCategory, setActiveCategory] = useState("Semua");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProducts = products.filter(product => {
    const matchCategory = activeCategory === "Semua" || product.category === activeCategory;
    const matchSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        product.seller.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  return (
    <AppShell active="/marketplace">
      <PageHeader eyebrow="Marketplace Jamaah" title="Belanja Produk Halal" />
      
      <section className="mb-6 rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="relative mb-5">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari produk atau seller..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-slate-100 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100"
          />
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-2">
          {allCategories.map(category => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`shrink-0 rounded-full px-5 py-2 text-sm font-bold transition ${
                activeCategory === category
                  ? "bg-emerald-700 text-white shadow-md"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </section>

      {filteredProducts.length === 0 ? (
        <section className="rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-100">
          <ShoppingBag className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-lg font-bold text-slate-500">Produk tidak ditemukan</p>
          <p className="text-sm text-slate-400">Coba ganti kata kunci atau pilih kategori lain.</p>
        </section>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </section>
      )}
    </AppShell>
  );
}
