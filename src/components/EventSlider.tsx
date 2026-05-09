"use client";
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

interface EventSlide {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  speaker: string;
  category: string;
  status: string;
  registrants: number;
  image?: string;
}

export function EventSlider({ events }: { events: EventSlide[] }) {
  const [current, setCurrent] = useState(0);
  const activeEvents = events.filter((e) => e.status === "Aktif");
  const slides = activeEvents.length > 0 ? activeEvents : events;
  const total = slides.length;

  useEffect(() => {
    if (total <= 1) return;
    const timer = setInterval(() => setCurrent((c) => (c + 1) % total), 5000);
    return () => clearInterval(timer);
  }, [total]);

  const prev = () => setCurrent((c) => (c - 1 + total) % total);
  const next = () => setCurrent((c) => (c + 1) % total);

  if (total === 0) return null;

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-black text-slate-900">📅 Main Event</h2>
        <Link href="/events" className="text-xs font-bold text-emerald-700 hover:text-emerald-800">
          Lihat Semua
        </Link>
      </div>

      {/* Container Banner - Rasio Lebar (Landscape) */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-slate-100 shadow-md aspect-[2/1] sm:aspect-[21/9]">
        {/* Slide content */}
        <div 
          className="flex h-full transition-transform duration-500 ease-in-out" 
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {slides.map((evt) => (
            <div key={evt.id} className="relative w-full h-full shrink-0 group">
              {/* Gambar Banner */}
              <img 
                src={evt.image || `https://placehold.co/800x400/047857/ffffff?text=${encodeURIComponent(evt.title)}`}
                alt={evt.title}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              
              {/* Overlay Gradient Hitam (untuk baca teks) */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
              
              {/* Teks Overlay di Bawah */}
              <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 text-white">
                <span className="mb-2 inline-block rounded-lg bg-emerald-600/90 backdrop-blur px-2.5 py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                  {evt.category}
                </span>
                <h3 className="text-lg sm:text-2xl font-black text-white shadow-black drop-shadow-lg leading-tight">
                  {evt.title}
                </h3>
                <p className="mt-1 text-xs sm:text-sm font-medium text-slate-200 drop-shadow-md">
                  {evt.date} • {evt.time} | {evt.location}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Tombol Panah Kiri/Kanan */}
        {total > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/40 transition opacity-0 group-hover:opacity-100 sm:opacity-100"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={next}
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/40 transition opacity-0 group-hover:opacity-100 sm:opacity-100"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {/* Indikator Titik (Dots) */}
        {total > 1 && (
          <div className="absolute bottom-4 right-4 flex items-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === current ? "w-5 bg-white shadow-sm" : "w-1.5 bg-white/50"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}