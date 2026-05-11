"use client";
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar, Clock3 } from "lucide-react";
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

      {/* Container Banner - Premium Ratio & Shadow */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 shadow-premium-lg ring-1 ring-white/10 aspect-[2/1] sm:aspect-[21/9]">
        {/* Slide content */}
        <div 
          className="flex h-full transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)]" 
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {slides.map((evt) => (
            <div key={evt.id} className="relative w-full h-full shrink-0 group">
              {/* Gambar Banner */}
              <img 
                src={evt.image || `https://placehold.co/800x400/047857/ffffff?text=${encodeURIComponent(evt.title)}`}
                alt={evt.title}
                className="absolute inset-0 h-full w-full object-cover opacity-80 mix-blend-overlay transition-transform duration-1000 group-hover:scale-105"
              />
              
              {/* Overlay Premium Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/60 via-transparent to-transparent" />
              
              {/* Teks Overlay di Bawah */}
              <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8 text-white">
                <span className="mb-3 inline-block rounded-xl glass px-3 py-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-white shadow-sm border border-white/20">
                  {evt.category}
                </span>
                <h3 className="text-xl sm:text-3xl font-black text-white shadow-black drop-shadow-2xl leading-tight tracking-tight max-w-2xl">
                  {evt.title}
                </h3>
                <div className="mt-3 flex items-center gap-2 text-xs sm:text-sm font-semibold text-emerald-50 drop-shadow-md">
                  <span className="flex items-center gap-1.5 glass px-2.5 py-1 rounded-lg border border-white/10"><Calendar className="w-3.5 h-3.5" />{evt.date}</span>
                  <span className="flex items-center gap-1.5 glass px-2.5 py-1 rounded-lg border border-white/10"><Clock3 className="w-3.5 h-3.5" />{evt.time}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tombol Panah Kiri/Kanan */}
        {total > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl glass text-white hover:bg-white/30 transition-all opacity-0 group-hover:opacity-100 sm:opacity-100 shadow-sm border border-white/20 hover:scale-105"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={next}
              className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl glass text-white hover:bg-white/30 transition-all opacity-0 group-hover:opacity-100 sm:opacity-100 shadow-sm border border-white/20 hover:scale-105"
            >
              <ChevronRight className="h-6 w-6" />
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