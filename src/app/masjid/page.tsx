"use client";
import { BookOpen, Calendar, HeartHandshake } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import Link from "next/link";

const menuItems = [
  {
    href: "/dakwah",
    icon: BookOpen,
    title: "Media Dakwah",
    description: "Kajian, artikel, dan video dakwah",
    color: "from-emerald-600 to-emerald-700",
  },
  {
    href: "/infaq",
    icon: HeartHandshake,
    title: "Infaq & Shadaqah",
    description: "Campaign donasi dan sedekah",
    color: "from-teal-600 to-teal-700",
  },
  {
    href: "/events",
    icon: Calendar,
    title: "Main Event",
    description: "Acara dan kegiatan masjid",
    color: "from-cyan-600 to-cyan-700",
  },
];

export default function MasjidPage() {
  return (
    <AppShell active="/masjid">
      <PageHeader eyebrow="Menu Masjid" title="Kegiatan & Dakwah" />
      
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
