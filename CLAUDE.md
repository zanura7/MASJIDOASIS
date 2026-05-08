# CLAUDE

Panduan untuk AI coding agent saat mengembangkan Platform Komunitas Masjid.

## Konteks Produk

Produk adalah web app komunitas/masjid yang mencakup marketplace, media dakwah, rekber/wallet, integrasi pembayaran dan pengiriman, tanya jawab, infaq/shadaqah, blast informasi, dan REST API eksternal.

Target utama:

- Member/jamaah dapat login, melihat produk, order, bertanya, membaca konten, dan berdonasi.
- Seller dapat mengelola produk, memproses order, dan withdraw saldo.
- Admin dapat mengelola user, produk, konten, transaksi, saldo, pembayaran, dan dispute.
- Ustadz/dokter dapat menjawab pertanyaan member.

## Scope Utama

- Web app responsif, bukan mobile app native.
- Login OTP nomor HP.
- Marketplace dengan produk, kategori, search, order, seller dashboard.
- Midtrans untuk payment gateway.
- Escrow/wallet dengan ledger dan withdraw manual.
- KiriminAja untuk ongkir/pengiriman/tracking.
- Media dakwah tulisan/video, feed, komentar.
- Tanya jawab Member-Ustadz/Dokter.
- Infaq/shadaqah basic crowdfunding.
- WhatsApp blast dan email blast via provider eksternal.
- REST API eksternal sesuai endpoint yang disetujui.

## Batasan

- Jangan memasukkan credential asli ke repository, dokumentasi publik, atau contoh kode.
- Mobile app Android/iOS di luar scope awal kecuali ada task khusus.
- Pengembangan fitur baru di luar scope harus dicatat sebagai change request.
- Operasional non-teknis seperti komplain user, refund manual, dan keputusan dispute adalah tanggung jawab admin/klien; sistem hanya menyediakan alat bantu.
- Integrasi pihak ketiga bergantung credential, sandbox, production approval, limit, dan perubahan API provider.

## Workflow Coding

1. Baca `README.md`, `PLAN.md`, dan `TASK.md` sebelum mulai task.
2. Pecah pekerjaan menjadi modul kecil dan pastikan setiap modul punya acceptance criteria.
3. Jangan mengubah file yang tidak terkait tanpa alasan jelas.
4. Gunakan migration untuk perubahan schema database.
5. Tambahkan audit log untuk semua aksi admin dan mutasi saldo.
6. Tambahkan test untuk payment, wallet, shipping, permission, dan webhook.
7. Update dokumentasi ketika flow, environment variable, atau endpoint berubah.

## Environment Variable Placeholder

Gunakan placeholder berikut; jangan isi nilai asli di repo.

```env
APP_URL=
DATABASE_URL=
REDIS_URL=
JWT_SECRET=
OTP_PROVIDER=
OTP_API_KEY=
MIDTRANS_SERVER_KEY=
MIDTRANS_CLIENT_KEY=
MIDTRANS_IS_PRODUCTION=false
KIRIMINAJA_API_KEY=
WHATSAPP_PROVIDER=
WHATSAPP_API_KEY=
EMAIL_PROVIDER=
EMAIL_API_KEY=
STORAGE_DISK=
STORAGE_ACCESS_KEY=
STORAGE_SECRET_KEY=
```

## Payment dan Wallet Rules

- Webhook Midtrans harus divalidasi signature/status sebelum mengubah order.
- Webhook harus idempotent; callback ganda tidak boleh menggandakan ledger.
- Dana payment marketplace masuk sebagai escrow terlebih dahulu.
- Dana baru pindah ke saldo seller setelah order completed atau admin release.
- Withdraw seller harus melalui request dan approval admin.
- Semua perubahan saldo wajib masuk ledger immutable.
- Jangan pernah menghapus transaksi/ledger; gunakan reversal/adjustment bila perlu.

## Shipping Rules

- Ongkir dan shipment dibuat melalui service adapter KiriminAja.
- Simpan request/response penting untuk audit dan debugging.
- Jika API pengiriman gagal, sediakan fallback input resi manual oleh seller/admin.
- Tracking harus terbaca oleh buyer, seller, dan admin.

## Admin dan Permission

- Semua endpoint admin harus dilindungi role admin.
- Seller hanya boleh mengelola produk dan order miliknya.
- Ustadz/dokter hanya boleh menjawab Q&A yang sesuai role/assignment.
- Member hanya boleh melihat/mengubah data miliknya sendiri.
- Aksi sensitif seperti release escrow, approve withdraw, deactivate user, dan delete product harus masuk audit log.

## API Integration Pattern

- Bungkus setiap provider dalam service/adapter: `PaymentProvider`, `ShippingProvider`, `WhatsappProvider`, `EmailProvider`.
- Pisahkan konfigurasi sandbox dan production.
- Buat retry terbatas untuk request yang aman diulang.
- Jangan retry operasi yang dapat membuat transaksi ganda tanpa idempotency key.
- Log error provider tanpa membocorkan secret/token.

## Definition of Done

Task dianggap selesai jika:

- Feature berjalan sesuai acceptance criteria.
- Permission dan validasi input aman.
- Test penting ditambahkan atau minimal checklist manual testing ditulis.
- Tidak ada credential asli di commit.
- Dokumentasi terkait diperbarui.
- Flow keuangan memiliki audit trail dan tidak membuat saldo ganda.

## Referensi Scope SOW

SOW menyebut deliverable web app siap digunakan, admin panel lengkap, sistem rekber/wallet berjalan, integrasi API berjalan, dan dokumentasi dasar. Estimasi 30-45 hari kerja dengan biaya penuh Rp 25.000.000 - Rp 35.000.000 atau opsi kolaborasi Rp 15.000.000 - Rp 20.000.000 plus maintenance Rp 500.000 - Rp 1.500.000 per bulan.
