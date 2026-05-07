import { BookOpen, HeartHandshake, Package, Search, ShoppingCart } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CampaignCard, FeedCard, OrderCard, ProductCard, SectionTitle, StatCard } from "@/components/Cards";
import { PageHeader } from "@/components/PageHeader";
import { campaigns, categories, feeds, orders, products, stats } from "@/data/mock";

export default function UserDashboardPage() {
  const icons = [ShoppingCart, Package, HeartHandshake, BookOpen];
  return (
    <AppShell active="/">
      <PageHeader eyebrow="Assalamu’alaikum, Adi" title="Dashboard Jamaah" />
      
      <section className="mb-6 rounded-[1.5rem] sm:rounded-[2rem] bg-gradient-to-r from-emerald-800 via-emerald-700 to-lime-700 p-5 sm:p-6 text-white shadow-lg md:p-8">
        <div className="grid gap-6 md:grid-cols-[1.4fr_0.8fr] md:items-center">
          <div>
            <p className="mb-3 inline-flex rounded-full bg-white/15 px-4 py-2 text-[10px] sm:text-xs md:text-sm font-semibold">Marketplace aman dengan rekber masjid</p>
            <h2 className="text-2xl sm:text-3xl font-black leading-tight md:text-5xl">Belanja, berdonasi, dan belajar dalam satu aplikasi.</h2>
            <p className="mt-3 sm:mt-4 max-w-2xl text-xs sm:text-sm leading-5 sm:leading-6 text-emerald-50 md:text-base">Temukan produk jamaah, ikuti kajian, ajukan pertanyaan, dan pantau transaksi escrow secara transparan.</p>
            <div className="mt-5 sm:mt-6 flex flex-wrap gap-2 sm:gap-3">
              <a href="/marketplace" className="rounded-xl sm:rounded-2xl bg-white px-4 sm:px-5 py-2.5 sm:py-3 text-sm sm:text-base font-bold text-emerald-800">Mulai Belanja</a>
              <a href="/dakwah" className="rounded-xl sm:rounded-2xl border border-white/30 px-4 sm:px-5 py-2.5 sm:py-3 text-sm sm:text-base font-bold text-white">Lihat Kajian</a>
            </div>
          </div>
          <div className="rounded-[1.5rem] sm:rounded-3xl bg-white/10 p-3 sm:p-4 backdrop-blur">
            <div className="rounded-xl sm:rounded-2xl bg-white p-3 sm:p-4 text-slate-900">
              <p className="text-xs sm:text-sm text-slate-500">Order aktif</p>
              <p className="mt-1 text-xl sm:text-2xl font-black">2 Pesanan</p>
              <div className="mt-3 sm:mt-4 space-y-2 sm:space-y-3">
                {orders.slice(0,2).map(order => (
                  <div key={order.id} className="rounded-xl sm:rounded-2xl bg-emerald-50 p-2.5 sm:p-3">
                    <p className="text-xs sm:text-sm font-bold text-emerald-800">{order.title}</p>
                    <p className="text-[10px] sm:text-xs text-slate-500">{order.status} • {order.courier}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-6 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
        {stats.map((stat, index) => {
          const Icon = icons[index];
          return <StatCard key={stat.label} icon={<Icon className="h-4 w-4 sm:h-5 sm:w-5" />} label={stat.label} value={stat.value} />;
        })}
      </section>

      <section className="mb-6 rounded-2xl sm:rounded-3xl bg-white p-3 sm:p-4 shadow-sm ring-1 ring-slate-100">
        <div className="flex items-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl bg-slate-50 px-3 sm:px-4 py-2.5 sm:py-3">
          <Search className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400" />
          <span className="text-xs sm:text-sm text-slate-400">Cari produk halal, kajian, campaign infaq...</span>
        </div>
        <div className="hide-scrollbar mt-3 sm:mt-4 flex gap-2 overflow-x-auto pb-1">
          {categories.map(category => (
            <span key={category} className="whitespace-nowrap rounded-full bg-emerald-50 px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-sm font-semibold text-emerald-700">{category}</span>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section>
            <SectionTitle title="Produk Pilihan Jamaah" />
            <div className="hide-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0 flex gap-3 sm:gap-4 overflow-x-auto pb-2">
              {products.slice(0,3).map(product => <ProductCard key={product.id} product={product} />)}
            </div>
          </section>
          
          <section className="rounded-2xl sm:rounded-3xl bg-white p-4 sm:p-5 shadow-sm ring-1 ring-slate-100">
            <SectionTitle title="Media Dakwah" icon={<BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-700" />} />
            <div className="space-y-2 sm:space-y-3">
              {feeds.slice(0,2).map(feed => <FeedCard key={feed.id} feed={feed} />)}
            </div>
          </section>
        </div>
        
        <aside className="space-y-6">
          <section className="rounded-2xl sm:rounded-3xl bg-white p-4 sm:p-5 shadow-sm ring-1 ring-slate-100">
            <SectionTitle title="Pesanan Terbaru" />
            <div className="space-y-2 sm:space-y-3">
              {orders.slice(0,2).map(order => <OrderCard key={order.id} order={order} />)}
            </div>
          </section>
          <CampaignCard campaign={campaigns[0]} />
        </aside>
      </div>
    </AppShell>
  );
}