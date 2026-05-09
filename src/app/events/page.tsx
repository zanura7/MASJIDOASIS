"use client";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";

export default function EventsPage() {
  return (
    <AppShell active="/events">
      <PageHeader eyebrow="Masjid" title="Main Event" />
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <p className="text-sm text-slate-500">Daftar acara dan kegiatan masjid akan tampil di sini.</p>
      </section>
    </AppShell>
  );
}
