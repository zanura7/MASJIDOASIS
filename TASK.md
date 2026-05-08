# TASK

Checklist implementasi teknis untuk platform komunitas masjid.

## 1. Fondasi Project

- [ ] Tentukan stack backend, frontend, database, queue, storage, dan deployment.
- [ ] Buat struktur repository dan standar environment.
- [ ] Siapkan konfigurasi `.env.example` tanpa credential asli.
- [ ] Buat migration awal dan seed role.
- [ ] Siapkan layout web responsif untuk member, seller, dan admin.
- [ ] Siapkan logging, error handling, dan audit trail dasar.

## 2. Auth dan User

- [ ] Implement login OTP nomor HP.
- [ ] Buat fallback OTP development untuk testing.
- [ ] Buat profil user: nama, foto, nomor WhatsApp, alamat dasar.
- [ ] Buat role dan permission: member, seller, admin, ustadz, dokter.
- [ ] Buat fitur deactivate user oleh admin.
- [ ] Buat validasi session/token dan middleware role.

## 3. Marketplace

- [ ] Buat model kategori produk.
- [ ] Buat model produk: seller, nama, foto, harga, deskripsi, kategori, status, stok.
- [ ] Buat halaman list produk grid/list.
- [ ] Buat halaman detail produk.
- [ ] Buat pencarian dan filter kategori.
- [ ] Buat tombol chat WhatsApp ke seller.
- [ ] Buat moderation status produk oleh admin.

## 4. Seller Dashboard

- [ ] Buat dashboard ringkasan seller.
- [ ] Buat form tambah/edit produk.
- [ ] Buat upload foto produk.
- [ ] Buat hapus/nonaktif produk.
- [ ] Buat daftar order seller.
- [ ] Buat status pengiriman dan input resi manual.
- [ ] Buat halaman saldo dan withdraw seller.

## 5. Order dan Checkout

- [ ] Buat model order dan order item.
- [ ] Buat checkout produk.
- [ ] Hitung subtotal, ongkir, fee, dan total.
- [ ] Buat status order: pending_payment, paid, processing, shipped, completed, cancelled, dispute.
- [ ] Buat halaman riwayat order buyer.
- [ ] Buat halaman detail order untuk buyer, seller, admin.
- [ ] Buat pembatalan order sebelum pembayaran.

## 6. Midtrans Payment

- [ ] Siapkan konfigurasi Midtrans sandbox/production.
- [ ] Implement create payment transaction.
- [ ] Implement webhook callback Midtrans.
- [ ] Validasi signature dan status pembayaran.
- [ ] Buat idempotency agar webhook ganda tidak menggandakan saldo.
- [ ] Simpan payment log dan raw callback aman.
- [ ] Uji skenario success, pending, expire, cancel, deny.

## 7. Rekber, Wallet, dan Ledger

- [ ] Buat model wallet user/seller/admin.
- [ ] Buat ledger immutable untuk semua mutasi saldo.
- [ ] Catat dana masuk sebagai escrow setelah payment success.
- [ ] Buat release escrow ke saldo seller saat order completed.
- [ ] Buat withdraw request seller.
- [ ] Buat approval/reject withdraw oleh admin.
- [ ] Buat audit log untuk release, withdraw, refund, dan adjustment.
- [ ] Buat laporan saldo tertahan, saldo seller, dan total transaksi.

## 8. KiriminAja Shipping

- [ ] Siapkan konfigurasi API KiriminAja.
- [ ] Buat service cek ongkir.
- [ ] Buat service create shipment/order pengiriman.
- [ ] Simpan kurir, layanan, ongkir, resi, dan tracking status.
- [ ] Buat halaman tracking untuk buyer dan seller.
- [ ] Buat fallback input resi manual.
- [ ] Uji API sandbox/production sesuai credential.

## 9. Media Dakwah

- [ ] Buat model konten dakwah: judul, slug, isi, video URL, kategori, status.
- [ ] Buat admin editor konten.
- [ ] Buat feed konten untuk member.
- [ ] Buat halaman detail konten.
- [ ] Buat komentar dan moderasi komentar.
- [ ] Buat publish/unpublish dan jadwal publikasi bila diperlukan.

## 10. Tanya Jawab Ustadz/Dokter

- [ ] Buat kategori Q&A: ustadz, dokter, umum.
- [ ] Buat form pertanyaan member.
- [ ] Buat assignment pertanyaan ke role ustadz/dokter.
- [ ] Buat halaman jawab pertanyaan untuk narasumber.
- [ ] Buat moderasi admin sebelum/after publish.
- [ ] Buat status pertanyaan: pending, answered, rejected, closed.

## 11. Infaq dan Shadaqah

- [ ] Buat model campaign donasi.
- [ ] Buat halaman list dan detail campaign.
- [ ] Buat payment donasi via Midtrans.
- [ ] Buat riwayat donasi member.
- [ ] Buat laporan donasi admin.
- [ ] Buat opsi tampil anonim bila diperlukan.

## 12. Chat dan Notifikasi

- [ ] Buat chat internal antar user.
- [ ] Simpan riwayat chat.
- [ ] Buat notifikasi order, payment, shipment, Q&A, dan withdraw.
- [ ] Tentukan channel notifikasi: in-app, WhatsApp, email.
- [ ] Buat rate limit untuk notifikasi agar tidak spam.

## 13. WhatsApp dan Email Blast

- [ ] Pilih provider WhatsApp: Fonte, Wablas, atau provider lain.
- [ ] Pilih provider email: Kirim.email, Resend, atau provider lain.
- [ ] Buat segmentasi member.
- [ ] Buat template pesan.
- [ ] Buat preview dan approval blast.
- [ ] Buat histori blast dan status pengiriman.
- [ ] Buat unsubscribe/preference untuk email bila diperlukan.

## 14. REST API Eksternal

- [ ] Tentukan endpoint yang akan dibuka untuk platform eksternal.
- [ ] Buat autentikasi API key/token.
- [ ] Buat rate limiting dan access log.
- [ ] Buat endpoint produk, order, user terbatas, konten, atau data lain sesuai scope.
- [ ] Buat dokumentasi endpoint dan contoh request/response.
- [ ] Buat versioning API.

## 15. Admin Panel

- [ ] Dashboard ringkasan user, produk, order, transaksi, saldo.
- [ ] CRUD user dan role.
- [ ] Moderasi produk.
- [ ] Moderasi konten dakwah dan komentar.
- [ ] Monitoring order dan payment.
- [ ] Approval release escrow, withdraw, refund/dispute.
- [ ] Log aktivitas admin.

## 16. Security dan Compliance

- [ ] Jangan simpan credential asli di repository.
- [ ] Validasi semua webhook dengan signature.
- [ ] Gunakan authorization per role untuk semua endpoint sensitif.
- [ ] Sanitasi input konten, komentar, chat, dan Q&A.
- [ ] Rate limit login OTP, chat, blast, dan API eksternal.
- [ ] Backup database berkala.
- [ ] Audit semua perubahan saldo dan status transaksi.

## 17. Testing dan Deployment

- [ ] Unit test service penting: payment, wallet, shipping, permission.
- [ ] Integration test webhook Midtrans.
- [ ] Integration test KiriminAja.
- [ ] E2E test alur buyer checkout sampai order completed.
- [ ] E2E test seller withdraw.
- [ ] UAT bersama klien/pengurus.
- [ ] Setup domain, SSL, database, storage, queue, dan cron.
- [ ] Buat dokumentasi deployment dan operasional.

## 18. Maintenance Kolaborasi

- [ ] Buat SOP response time maksimal 1 x 24 jam.
- [ ] Tentukan definisi critical dan non-critical issue.
- [ ] Monitoring error log dan performa server.
- [ ] Backup database berkala.
- [ ] Catat minor update yang termasuk maintenance.
- [ ] Catat fitur baru/change request yang di luar maintenance.
