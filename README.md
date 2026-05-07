# MASJIDOASIS

Prototype UI untuk Platform Komunitas Masjid.

## Stack Saat Ini

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Lucide React Icons

## Fokus Prototype Phase 1

Dashboard user/jamaah dengan mock data terstruktur:

- Sidebar desktop dan bottom navigation mobile.
- Hero dashboard jamaah.
- Ringkasan cart, order aktif, donasi, dan kajian.
- Search dan kategori marketplace.
- Produk pilihan jamaah.
- Pesanan terbaru.
- Media dakwah.
- Campaign infaq.

## Halaman Prototype

- `/` — Dashboard user/jamaah.
- `/marketplace` — Listing produk dan kategori.
- `/orders` — Riwayat dan tracking pesanan.
- `/dakwah` — Kajian, artikel, dan video dakwah.
- `/infaq` — Campaign infaq/shadaqah.
- `/wallet` — Saldo wallet, escrow summary, dan mutasi ledger.
- `/tanya-ustadz` — Form konsultasi dan daftar pertanyaan.
- `/test-kesehatan` — Form pendaftaran cek kesehatan dan tiket antrian.
- `/profile` — Profil user dan wallet summary.

### Admin Route
- `/admin` — Dashboard admin untuk monitoring user, escrow, pesanan, dan Q&A ustadz.

## Struktur UI

```text
src/
├── app/
│   ├── page.tsx
│   ├── marketplace/page.tsx
│   ├── orders/page.tsx
│   ├── dakwah/page.tsx
│   ├── infaq/page.tsx
│   ├── profile/page.tsx
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── AppShell.tsx
│   ├── Cards.tsx
│   └── PageHeader.tsx
└── data/
    └── mock.ts
```

## Menjalankan Project

```bash
npm install
npm run dev
```

Buka:

```text
http://localhost:3000
```

## Build Check

```bash
npm run build
```

## Catatan

Repository GitHub awal masih kosong, jadi struktur Next.js dibuat sebagai baseline frontend prototype. Nama package npm menggunakan lowercase `masjidoasis` karena npm tidak menerima nama package huruf besar.
