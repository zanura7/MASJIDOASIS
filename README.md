# Platform Komunitas Masjid

Dokumen ini merangkum kebutuhan produk untuk web app komunitas/masjid yang menggabungkan marketplace, media dakwah, rekber/wallet, tanya jawab, infaq/shadaqah, dan integrasi pihak ketiga.

## Ringkasan

Platform ini ditujukan untuk jamaah/member, penjual, admin/pengurus, serta narasumber seperti ustadz dan dokter. Fokus awal adalah web app yang siap digunakan untuk transaksi komunitas, publikasi konten dakwah, dan pengelolaan transaksi secara aman melalui admin/rekber.

## Target Pengguna

- Member/Jamaah: daftar/login, melihat produk, membeli, bertanya, berdonasi, membaca konten dakwah.
- Penjual: mengelola produk, menerima order, mengirim barang, mengajukan withdraw.
- Admin/Pengurus: mengelola user, produk, konten, transaksi, pembayaran, saldo, dispute, dan blast informasi.
- Ustadz/Dokter: menjawab pertanyaan member pada modul tanya jawab.

## Lingkup Produk

### Platform Multi-Channel

Platform ini terdiri dari 3 aplikasi yang saling terintegrasi:

1. **Backend API (Go)**: REST API sebagai single source of truth untuk semua business logic.
2. **Mobile App (Flutter)**: Aplikasi native iOS dan Android untuk member, seller, dan narasumber.
3. **Web App (Next.js)**: Web responsif untuk member, seller, admin, dan narasumber.

### Sistem User

- Login OTP nomor HP (SMS provider).
- Profil user: nama, foto, nomor WhatsApp, email, alamat.
- Role user: member, seller, admin, ustadz, dokter.
- Permission berbasis role untuk akses fitur dan endpoint.

### Marketplace

- List dan detail produk dengan pagination dan filter.
- Kategori produk dan pencarian keyword.
- Sistem cart dan checkout.
- Integrasi payment gateway Midtrans (Snap/Core API).
- Order management dengan status flow lengkap.
- Rating dan review produk (optional).

### Sistem Penjual

- CRUD produk: foto, nama, harga, deskripsi, kategori, stok/status.
- Dashboard penjual: statistik order, revenue, produk aktif.
- Riwayat order dan status pengiriman.
- Saldo penjual dan pengajuan withdraw.
- Notifikasi order baru via push notification dan WhatsApp.

### Media Dakwah

- CMS konten dakwah: tulisan dan video.
- Feed konten dakwah dengan kategori.
- Komentar dan interaksi dasar.
- Publish/unpublish konten oleh admin.

### Rekber / Wallet

- Ledger immutable untuk semua mutasi saldo.
- Saldo user dan penjual.
- Dana tertahan/escrow setelah pembayaran berhasil.
- Monitoring status transaksi real-time.
- Release dana ke seller setelah order completed.
- Withdraw manual oleh seller melalui approval admin.
- Audit trail untuk semua transaksi keuangan.

### Admin Panel (Web)

- Dashboard: statistik user, produk, order, revenue.
- Kelola user: list, detail, deactivate/activate, change role.
- Kelola produk: list, detail, approve/reject, delete.
- Kelola konten dakwah: publish/unpublish, moderate komentar.
- Monitoring transaksi dan saldo real-time.
- Approval pembayaran, release saldo, withdraw, dan penanganan dispute.
- Audit log viewer untuk aksi sensitif.
- Settings: payment config, shipping config, notification config.

### Fitur Tambahan

- Tanya jawab Member-Ustadz dan Member-Dokter dengan moderasi.
- Infaq dan shadaqah berbasis crowdfunding sederhana.
- WhatsApp blast menggunakan Fonte/Wablas atau provider sejenis.
- Email blast menggunakan Kirim.email/Resend atau provider sejenis.
- Push notification via Firebase Cloud Messaging (FCM).
- REST API eksternal dengan API key authentication untuk integrasi pihak ketiga.

## Integrasi

- Payment Gateway: Midtrans.
- Pengiriman: KiriminAja.com.
- WhatsApp Blast: Fonte/Wablas.
- Email Blast: Kirim.email/Resend.
- API eksternal: disiapkan dengan autentikasi, rate limit, dan dokumentasi endpoint.

## Alur Transaksi Utama

1. Buyer memilih produk dan checkout.
2. Buyer memilih metode pembayaran Midtrans.
3. Sistem membuat order dengan status menunggu pembayaran.
4. Midtrans mengirim webhook pembayaran berhasil.
5. Sistem mencatat dana sebagai saldo tertahan/escrow admin.
6. Seller menerima notifikasi dan memproses pengiriman.
7. Sistem membuat/menyimpan data pengiriman melalui KiriminAja dan nomor resi.
8. Buyer menerima barang lalu order diselesaikan.
9. Sistem/admin me-release dana dari escrow ke saldo seller.
10. Seller mengajukan withdraw, admin memproses manual.

## Stack dan Arsitektur yang Disarankan

Stack disesuaikan untuk kebutuhan multi-platform (API, Mobile, Web):

- Backend API: Go (Golang) dengan framework Fiber/Gin.
- Database: PostgreSQL (primary) + Redis (cache, session, queue).
- Mobile App: Flutter (Dart) untuk iOS dan Android native (Single codebase).
- Web App: Next.js (React + TypeScript) dengan UI responsif.
- Storage: S3-compatible/object storage untuk foto produk, avatar, dan media konten.
- Admin Panel: Tergabung dalam Web App dengan akses berbasis role admin.
- Integrasi: Adapter/service terpisah untuk Midtrans, KiriminAja, WhatsApp provider, dan email provider.
- Infrastruktur: VPS dengan Docker + Docker Compose, Nginx sebagai reverse proxy.

## Cara Setup Development

### Prerequisites

- Go 1.21+ (untuk backend)
- Flutter 3.19+ (untuk mobile)
- Node.js 20+ dan npm/yarn (untuk web)
- PostgreSQL 15+
- Redis 7+
- Docker dan Docker Compose (recommended)

### Backend API (Go)

```bash
# Clone repository
git clone <repository-url>
cd backend

# Copy environment file
cp .env.example .env

# Edit .env dengan credential sandbox
nano .env

# Install dependencies
go mod download

# Run database migration
go run cmd/migrate/main.go up

# Seed initial data (roles, admin user)
go run cmd/seed/main.go

# Run development server
go run cmd/api/main.go
# API akan berjalan di http://localhost:8080
```

### Mobile App (Flutter)

```bash
cd mobile

# Install dependencies
flutter pub get

# Copy environment file
cp .env.example .env

# Edit .env dengan API endpoint
nano .env

# Run on iOS simulator
flutter run -d ios

# Run on Android emulator
flutter run -d android

# Build APK for testing
flutter build apk --debug
```

### Web App (Next.js)

```bash
cd web

# Install dependencies
npm install
# atau
yarn install

# Copy environment file
cp .env.example .env.local

# Edit .env.local dengan API endpoint
nano .env.local

# Run development server
npm run dev
# atau
yarn dev

# Web akan berjalan di http://localhost:3000
```

### Docker Compose (All-in-One)

```bash
# Clone repository
git clone <repository-url>
cd platform-komunitas-masjid

# Copy environment files
cp .env.example .env
cp backend/.env.example backend/.env
cp web/.env.example web/.env.local

# Edit semua .env files dengan credential yang sesuai

# Build dan run semua services
docker-compose up -d

# Services yang berjalan:
# - Backend API: http://localhost:8080
# - Web App: http://localhost:3000
# - PostgreSQL: localhost:5432
# - Redis: localhost:6379
# - Adminer (DB GUI): http://localhost:8081

# Lihat logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Environment Variables

Contoh environment wajib disiapkan untuk **Backend API**:

```env
# Application
APP_ENV=development
APP_URL=http://localhost:8080
APP_PORT=8080
JWT_SECRET=your-super-secret-jwt-key-change-this

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/masjid_platform?sslmode=disable

# Redis
REDIS_URL=redis://localhost:6379/0

# OTP Provider (pilih salah satu)
OTP_PROVIDER=twilio
OTP_API_KEY=your-twilio-api-key
OTP_API_SECRET=your-twilio-api-secret
OTP_FROM_NUMBER=+1234567890

# Midtrans
MIDTRANS_SERVER_KEY=your-midtrans-server-key
MIDTRANS_CLIENT_KEY=your-midtrans-client-key
MIDTRANS_IS_PRODUCTION=false

# KiriminAja
KIRIMINAJA_API_KEY=your-kiriminaja-api-key
KIRIMINAJA_BASE_URL=https://api.kiriminaja.com/v1

# WhatsApp Provider (pilih salah satu: fonte, wablas)
WHATSAPP_PROVIDER=fonte
WHATSAPP_API_KEY=your-whatsapp-api-key
WHATSAPP_BASE_URL=https://api.fonnte.com

# Email Provider (pilih salah satu: kirim.email, resend)
EMAIL_PROVIDER=resend
EMAIL_API_KEY=your-email-api-key
EMAIL_FROM=noreply@masjid.com

# Storage (local atau S3-compatible)
STORAGE_DISK=local
STORAGE_PATH=./uploads
# Jika menggunakan S3:
# STORAGE_DISK=s3
# STORAGE_BUCKET=masjid-platform
# STORAGE_REGION=ap-southeast-1
# STORAGE_ACCESS_KEY=your-access-key
# STORAGE_SECRET_KEY=your-secret-key
# STORAGE_ENDPOINT=https://s3.amazonaws.com

# Firebase (untuk push notification)
FIREBASE_CREDENTIALS_PATH=./firebase-credentials.json
```

Contoh environment untuk **Web App** (`.env.local`):

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_APP_NAME=Platform Komunitas Masjid
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=your-midtrans-client-key
```

Contoh environment untuk **Mobile App** (`.env`):

```env
API_URL=http://localhost:8080
APP_NAME=Platform Komunitas Masjid
MIDTRANS_CLIENT_KEY=your-midtrans-client-key
```
- Termin pembayaran: DP 50%, pelunasan 50% saat live deployment.

## Estimasi dan Biaya

### Timeline Estimasi

Berdasarkan PLAN.md, estimasi total pengerjaan adalah **96-144 hari kerja** (sekitar 4-6.5 bulan kalender dengan 1 developer full-time, atau 2-3.5 bulan dengan 2 developers).

Breakdown per fase:
- Phase 0 (Setup): 3-5 hari kerja
- Phase 1 (UI/UX Design & Prototype): 7-10 hari kerja
- Phase 2-5 (Backend Core + Marketplace + Payment + Shipping): 32-48 hari kerja
- Phase 6-7 (Mobile + Web MVP): 18-27 hari kerja
- Phase 8-10 (Admin + Features + API): 28-42 hari kerja
- Phase 11 (Hardening + Deployment): 8-12 hari kerja

### Dokumentasi
- README.md: Overview produk dan setup development
- PLAN.md: Rencana pengembangan per fase
- TASK.md: Task breakdown dan acceptance criteria
- CLAUDE.md: Panduan untuk AI coding agent
- API Documentation: Swagger/OpenAPI atau Postman collection
- Deployment Guide: Step-by-step deployment ke VPS
- Operational Guide: Backup, monitoring, troubleshooting

## Repository Structure

```
platform-komunitas-masjid/
├── backend/                 # Go Backend API
│   ├── cmd/                # Entry points (api, migrate, seed)
│   ├── internal/           # Business logic
│   │   ├── models/        # Database models
│   │   ├── handlers/      # HTTP handlers
│   │   ├── services/      # Business services
│   │   ├── repositories/  # Data access layer
│   │   └── middleware/    # Auth, CORS, logging
│   ├── pkg/               # Shared packages
│   ├── migrations/        # Database migrations
│   ├── go.mod
│   └── .env.example
├── mobile/                 # Flutter Mobile App
│   ├── lib/
│   │   ├── main.dart
│   │   ├── screens/       # UI screens
│   │   ├── widgets/       # Reusable widgets
│   │   ├── services/      # API services
│   │   ├── models/        # Data models
│   │   └── providers/     # State management
│   ├── pubspec.yaml
│   └── .env.example
├── web/                    # Next.js Web App
│   ├── src/
│   │   ├── app/           # App router (Next.js 14+)
│   │   ├── components/    # React components
│   │   ├── lib/           # Utilities and API client
│   │   └── styles/        # CSS/Tailwind
│   ├── public/            # Static assets
│   ├── package.json
│   └── .env.example
├── docker-compose.yml      # All-in-one development
├── .env.example           # Root environment
├── README.md
├── PLAN.md
├── TASK.md
└── CLAUDE.md
```

## Tech Stack Summary

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Backend API | Go + Fiber/Gin | REST API, business logic |
| Database | PostgreSQL | Primary data store |
| Cache/Queue | Redis | Session, cache, job queue |
| Mobile App | Flutter (Dart) | iOS & Android native |
| Web App | Next.js (React + TS) | Responsive web, admin panel |
| Payment | Midtrans | Payment gateway |
| Shipping | KiriminAja | Ongkir & tracking |
| Messaging | Fonte/Wablas | WhatsApp blast |
| Email | Resend/Kirim.email | Email blast |
| Push Notif | Firebase FCM | Mobile push notification |
| Storage | Local/S3 | Image & media storage |
| Deployment | Docker + Nginx | Containerization & proxy |

## Next Steps

1. **Finalisasi Scope**: Review dan approval dokumen README.md, PLAN.md, TASK.md, CLAUDE.md
2. **Setup Credentials**: Daftar dan setup sandbox account untuk Midtrans, KiriminAja, SMS provider, WhatsApp provider, Email provider
3. **Repository Setup**: Initialize Git repository untuk backend, mobile, dan web
4. **Development Kickoff**: Mulai Phase 0 - Setup dan Phase 1 - Backend API Core
5. **Regular Sync**: Weekly progress update dan demo setiap milestone selesai

## Contact & Support

Untuk pertanyaan, diskusi scope, atau request demo, silakan hubungi tim development.

---

**Last Updated**: 2026-05-05  
**Version**: 2.0 (Multi-Platform)
