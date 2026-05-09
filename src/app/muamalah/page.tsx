"use client";
import { Banknote, Plane, ShoppingBag, Rocket } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import Link from "next/link";

const menuItems = [
  {
    href: "/marketplace",
    icon: ShoppingBag,
    title: "Marketplace",
    description: "Belanja produk halal dari jamaah",
    color: "from-blue-600 to-blue-700",
  },
  {
    href: "/ota",
    icon: Plane,
    title: "Online Travel Agent",
    description: "Umroh, haji, dan wisata religi",
    color: "from-indigo-600 to-indigo-700",
  },
  {
    href: "/crowdfunding",
    icon: Rocket,
    title: "Crowdfunding Bisnis",
    description: "Investasi dan pendanaan usaha jamaah",
    color: "from-purple-600 to-purple-700",
  },
];

export default function MuamalahPage() {
  return (
    <AppShell active="/muamalah">
      <PageHeader eyebrow="Menu Muamalah" title="Ekonomi & Bisnis" />
      
      <section className="grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
        {menuItems.map(({ href, icon: Icon, title, description, color }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-2xl sm:rounded-3xl bg-white p-5 sm:p-6 shadow-sm ring-1 ring-slate-100 transition hover:shadow-md hover:ring-emerald-200"
          >
            <div className={`mb-4 inline-flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${color} text-white shadow-sm`}>
              <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 group-hover:text-emerald-700">
              {title}
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              {description}
            </p>
          </Link>
        ))}
      </section>
    </AppShell>
  );
}
