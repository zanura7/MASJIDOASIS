# PLAN

Rencana pengembangan Platform Komunitas Masjid multi-platform (Backend API, Mobile App iOS/Android, Web App) dengan pembagian fase yang bisa dinegosiasikan sesuai prioritas, budget, dan kesiapan akun/API pihak ketiga.

## Tech Stack

### Backend API
- **Language**: Go (Golang)
- **Framework**: Fiber atau Gin
- **ORM**: GORM
- **Database**: PostgreSQL (primary) + Redis (cache, session, queue)
- **Auth**: JWT + OTP via SMS provider
- **Payment**: Midtrans SDK
- **Shipping**: KiriminAja API
- **Messaging**: WhatsApp (Fonte/Wablas), Email (Kirim.email/Resend)

### Mobile App (iOS & Android)
- **Framework**: Flutter (Dart)
- **State Management**: Riverpod atau Bloc
- **HTTP Client**: Dio
- **Local Storage**: Hive atau Drift
- **Push Notification**: Firebase Cloud Messaging

### Web App
- **Framework**: Next.js 14+ (React + TypeScript)
- **Styling**: Tailwind CSS
- **State Management**: Zustand atau React Query
- **API Client**: Axios atau Fetch
- **Deployment**: Vercel atau self-host di VPS

### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Reverse Proxy**: Nginx
- **Hosting**: VPS (seperti setup grokpi saat ini)
- **CI/CD**: GitHub Actions (optional)
- **Monitoring**: Prometheus + Grafana (optional)

## Prinsip Implementasi

- **API-First Development**: Backend REST API dikembangkan terlebih dahulu, digunakan oleh mobile dan web.
- **Single Source of Truth**: Semua business logic di backend, client hanya UI/UX layer.
- **Modular Architecture**: Setiap integrasi eksternal dibuat dengan adapter/service terpisah agar mudah diganti provider.
- **Audit Trail**: Dana transaksi harus selalu punya audit trail: order, payment, escrow, release, withdraw, refund/dispute.
- **Security First**: Permission per role, input validation, rate limiting, dan audit log untuk aksi sensitif.
- **Responsive Design**: Web app harus responsif untuk desktop dan mobile browser.

## Phase 0 - Finalisasi Scope dan Setup

**Estimasi**: 3-5 hari kerja.

### Deliverables
- Finalisasi nama produk, branding, role, dan struktur menu.
- Validasi flow order, escrow, withdraw, dispute, dan refund.
- Setup repository: backend (Go), mobile (Flutter), web (Next.js).
- Setup development environment: Docker Compose untuk backend + PostgreSQL + Redis.
- Siapkan akun/API sandbox: Midtrans, KiriminAja, Fonte/Wablas, Kirim.email/Resend.
- Buat ERD awal dan rancangan permission per role.
- Setup CI/CD pipeline dasar (optional).
- Tentukan SLA, termin pembayaran, dan batasan maintenance.

### Acceptance Criteria
- Scope final disetujui dan terdokumentasi di README.md, PLAN.md, TASK.md, CLAUDE.md.
- Semua credential/API sandbox tersedia dan tersimpan aman (.env, secrets).
- Struktur database dan flow transaksi disetujui.
- Repository backend, mobile, dan web sudah initialized dengan boilerplate.
- Docker Compose berjalan lokal untuk backend development.

## Phase 1 - UI/UX Design & Frontend Prototype

**Estimasi**: 7-10 hari kerja.

### Deliverables

#### 1. Dashboard User (Web & Mobile)
- **Login/Register Screen**: Form input nomor HP, OTP verification screen.
- **Home/Landing**: Hero section, kategori produk, featured products.
- **Product Listing**: Grid/list view produk dengan filter dan search.
- **Product Detail**: Gambar produk, deskripsi, harga, tombol add to cart.
- **Cart & Checkout**: List item di cart, form alamat pengiriman, pilih metode pembayaran.
- **Order History**: List order dengan status (pending, paid, shipped, completed).
- **Order Detail**: Detail order, tracking pengiriman, tombol konfirmasi terima barang.
- **Profile**: View dan edit profile user (nama, foto, email, alamat).
- **Media Dakwah**: Feed konten dakwah (tulisan/video), detail konten, komentar.
- **Q&A**: Form tanya jawab, list pertanyaan, detail jawaban dari ustadz/dokter.
- **Infaq/Shadaqah**: List campaign, detail campaign, form donasi.

#### 2. Dashboard Admin (Web Only)
- **Admin Login**: Form login khusus admin (email/password atau OTP).
- **Dashboard Overview**: Statistik user, produk, order, revenue (chart/graph).
- **User Management**: Table list user, filter by role, action (view, edit, deactivate).
- **Product Management**: Table list produk, filter by status/kategori, action (approve, reject, delete).
- **Order Management**: Table list order, filter by status, action (view detail, update status, release escrow).
- **Wallet Management**: Table ledger/transaksi, filter by type, action (approve withdraw, manual adjustment).
- **Content Management**: Table list konten dakwah, action (publish, unpublish, edit, delete).
- **Q&A Moderation**: Table list pertanyaan, assign ke ustadz/dokter, moderate jawaban.
- **Campaign Management**: Table list campaign infaq, action (create, edit, close).
- **Blast Notification**: Form blast WhatsApp/Email, segmentasi user, template message.
- **Audit Log**: Table log semua aksi sensitif (filter by user, action, date).
- **Settings**: Form config payment, shipping, notification provider.

#### 3. Design System & Components
- Color palette dan typography.
- Reusable components: Button, Input, Card, Modal, Table, Dropdown, etc.
- Responsive layout untuk mobile, tablet, desktop.
- Loading states, error states, empty states.
- Navigation: Navbar, Sidebar (admin), Bottom navigation (mobile).

#### 4. Prototype & Mockup
- Figma/Adobe XD design file (optional, jika ada designer).
- HTML/CSS static prototype atau Next.js/Flutter prototype dengan mock data.
- User flow diagram untuk alur utama (login, order, payment, admin approval).

### Acceptance Criteria
- Semua screen dashboard user (web & mobile) sudah ada prototype/mockup.
- Semua screen dashboard admin (web) sudah ada prototype/mockup.
- Design system dan component library terdefinisi dengan jelas.
- Prototype bisa di-navigate dan menunjukkan user flow utama.
- Stakeholder/klien approve design dan flow sebelum lanjut ke backend development.

## Phase 2 - Backend API Core + Auth

**Estimasi**: 7-10 hari kerja.

### Deliverables
- REST API structure: routing, middleware, error handling.
- Database migration system (golang-migrate atau GORM AutoMigrate).
- User model: id, phone, name, email, role (member, seller, admin, ustadz, dokter).
- OTP login: send OTP via SMS provider, verify OTP, generate JWT token.
- JWT middleware untuk protected endpoints.
- User profile CRUD.
- Role-based permission middleware.
- Health check endpoint.
- API documentation (Swagger/OpenAPI optional).

### Acceptance Criteria
- User bisa register/login dengan OTP nomor HP.
- JWT token valid dan bisa digunakan untuk akses protected endpoints.
- Permission middleware mencegah akses unauthorized.
- Database migration berjalan dengan baik.
- Frontend (Phase 1) bisa connect ke API dan test login flow.

## Phase 3 - Backend Marketplace Core

**Estimasi**: 8-12 hari kerja.

### Deliverables
- Product model: id, seller_id, name, description, price, stock, category, images, status.
- Category model dan CRUD.
- Product CRUD untuk seller (hanya bisa edit produk sendiri).
- Product list/detail/search untuk member (pagination, filter kategori, search keyword).
- Image upload dan storage (local disk atau S3-compatible).
- Admin product moderation: approve/reject/delete produk.
- Seller dashboard: list produk, statistik order.

### Acceptance Criteria
- Seller bisa menambah, mengubah, dan menghapus produk sendiri.
- Member bisa melihat list produk, detail, dan search.
- Admin bisa moderasi produk (approve/reject/delete).
- Image upload berjalan dan URL accessible.

## Phase 4 - Backend Order, Payment, Escrow, Wallet

**Estimasi**: 12-18 hari kerja.

### Deliverables
- Order model: id, buyer_id, seller_id, products, total, status, payment_method, shipping_address.
- Order status flow: pending_payment → paid → processing → shipped → completed / cancelled / dispute.
- Cart/checkout endpoint.
- Midtrans integration: Snap/Core API, generate payment link.
- Midtrans webhook: validate signature, update order status, create ledger entry.
- Wallet/Ledger model: user_id, type (escrow, balance, withdraw), amount, reference (order_id, etc), timestamp.
- Escrow logic: dana payment masuk escrow, release ke seller setelah order completed.
- Withdraw request: seller request withdraw, admin approve/reject, update ledger.
- Audit log untuk semua mutasi saldo.
- Idempotency untuk webhook (prevent double ledger entry).

### Acceptance Criteria
- Payment berhasil dari sandbox Midtrans mengubah status order otomatis.
- Dana masuk ke escrow dan tidak langsung ke saldo seller.
- Admin dapat release saldo dan memproses withdraw.
- Semua mutasi saldo tercatat dan bisa ditelusuri.
- Webhook idempotent (callback ganda tidak menggandakan ledger).

## Phase 5 - Backend Shipping Integration

**Estimasi**: 5-8 hari kerja.

### Deliverables
- KiriminAja adapter: cek ongkir, generate shipment, tracking.
- Shipping model: order_id, courier, service, tracking_number, status.
- Endpoint cek ongkir untuk checkout.
- Endpoint generate shipment (seller/admin).
- Endpoint tracking resi (buyer, seller, admin).
- Fallback input resi manual bila API bermasalah.
- Webhook KiriminAja untuk update status pengiriman (optional).

### Acceptance Criteria
- Seller/admin bisa membuat pengiriman atau memasukkan resi manual.
- Buyer bisa melihat resi dan status pengiriman.
- Order hanya bisa completed setelah status valid atau manual confirmation.

## Phase 6 - Mobile App MVP (Flutter)

**Estimasi**: 10-15 hari kerja.

### Deliverables
- Splash screen dan onboarding.
- Login OTP screen (input phone, verify OTP).
- Home screen: list produk, kategori, search.
- Product detail screen.
- Cart dan checkout screen.
- Payment webview (Midtrans Snap).
- Order history dan order detail.
- Profile screen dan edit profile.
- Push notification setup (FCM).
- Responsive UI untuk berbagai ukuran layar.

### Acceptance Criteria
- User bisa login, browse produk, checkout, dan bayar via mobile app.
- Order history dan detail tampil dengan benar.
- Push notification berjalan (optional di fase ini).
- App berjalan smooth di iOS dan Android.

## Phase 7 - Web App MVP (Next.js)

**Estimasi**: 8-12 hari kerja.

### Deliverables
- Landing page dan hero section.
- Login OTP page (input phone, verify OTP).
- Product listing page dengan filter dan search.
- Product detail page.
- Cart dan checkout page.
- Payment integration (Midtrans Snap).
- Order history dan order detail page.
- Profile page dan edit profile.
- Responsive design (mobile, tablet, desktop).
- SEO optimization (meta tags, sitemap).

### Acceptance Criteria
- User bisa login, browse produk, checkout, dan bayar via web app.
- Order history dan detail tampil dengan benar.
- Web app responsif di semua device.
- SEO meta tags dan sitemap tersedia.

## Phase 8 - Admin Panel (Web)

**Estimasi**: 10-15 hari kerja.

### Deliverables
- Admin dashboard: statistik user, produk, order, revenue.
- User management: list, detail, deactivate/activate, change role.
- Product management: list, detail, approve/reject, delete.
- Order management: list, detail, update status, release escrow.
- Wallet management: list ledger, approve withdraw, manual adjustment.
- Dispute management: list dispute, resolve, refund.
- Audit log viewer.
- Settings: payment config, shipping config, notification config.

### Acceptance Criteria
- Admin bisa mengelola user, produk, order, dan saldo.
- Admin bisa release escrow dan approve withdraw.
- Admin bisa melihat audit log untuk semua aksi sensitif.
- Dashboard statistik akurat dan real-time.

## Phase 9 - Media Dakwah, Q&A, Infaq/Shadaqah

**Estimasi**: 10-15 hari kerja.

### Deliverables
- Content model: id, author_id, title, body, media_url, category, status, published_at.
- Content CRUD untuk admin.
- Content feed untuk member (pagination, filter kategori).
- Comment model dan CRUD.
- Q&A model: question (member), answer (ustadz/dokter), status.
- Q&A CRUD dan moderation.
- Campaign model untuk infaq/shadaqah: title, description, target_amount, current_amount, deadline.
- Donation endpoint: create donation, payment via Midtrans, update campaign amount.
- Campaign list dan detail.

### Acceptance Criteria
- Admin bisa publish konten dakwah (tulisan/video).
- Member bisa membaca konten dan berkomentar.
- Member bisa bertanya dan role narasumber bisa menjawab.
- Donasi/infaq tercatat dan status payment valid.
- Campaign amount terupdate otomatis setelah payment berhasil.

## Phase 10 - Blast Notification dan REST API Eksternal

**Estimasi**: 8-12 hari kerja.

### Deliverables
- Segmentasi member: by role, by location, by activity.
- WhatsApp blast adapter (Fonte/Wablas).
- Email blast adapter (Kirim.email/Resend).
- Blast template dan variable substitution.
- Blast history dan status tracking.
- REST API eksternal dengan API key authentication.
- API endpoints: user, product, order, content (read-only atau limited write).
- API documentation (Swagger/Postman collection).
- Rate limiting untuk API eksternal.

### Acceptance Criteria
- Admin bisa mengirim blast WhatsApp dan email ke segmen member tertentu.
- Sistem mencatat status pengiriman (sent, failed, pending).
- API eksternal bisa membaca/menulis data sesuai izin yang disetujui.
- API documentation lengkap dan mudah dipahami.

## Phase 11 - Hardening, Testing, UAT, Deployment

**Estimasi**: 8-12 hari kerja.

### Deliverables
- Unit testing untuk business logic kritis (payment, wallet, escrow).
- Integration testing untuk API endpoints.
- End-to-end testing untuk flow utama (order, payment, shipping).
- Security audit: SQL injection, XSS, CSRF, rate limiting, permission bypass.
- Performance testing: load testing, database query optimization.
- Backup dan restore procedure.
- Monitoring setup: logging, error tracking (Sentry optional), uptime monitoring.
- Deployment ke production VPS.
- SSL certificate setup (Let's Encrypt).
- Nginx configuration untuk backend API, web app, dan admin panel.
- Dokumentasi operasional: deployment guide, backup guide, troubleshooting guide.
- Handover dan training untuk admin/klien.

### Acceptance Criteria
- Semua flow prioritas lolos UAT.
- Tidak ada blocker keamanan/keuangan kritikal.
- Backend API, mobile app, dan web app live dan dapat digunakan.
- Monitoring dan backup berjalan.
- Dokumentasi operasional lengkap dan handover selesai.

## Timeline Estimasi

| Phase | Estimasi (hari kerja) | Kumulatif |
|-------|----------------------|-----------|
| Phase 0 | 3-5 | 3-5 |
| Phase 1 | 7-10 | 10-15 |
| Phase 2 | 7-10 | 17-25 |
| Phase 3 | 8-12 | 25-37 |
| Phase 4 | 12-18 | 37-55 |
| Phase 5 | 5-8 | 42-63 |
| Phase 6 | 10-15 | 52-78 |
| Phase 7 | 8-12 | 60-90 |
| Phase 8 | 10-15 | 70-105 |
| Phase 9 | 10-15 | 80-120 |
| Phase 10 | 8-12 | 88-132 |
| Phase 11 | 8-12 | 96-144 |

**Total estimasi**: 96-144 hari kerja (sekitar 4-6.5 bulan kalender dengan 1 developer full-time, atau 2-3.5 bulan dengan 2 developers).

## Risiko dan Mitigasi

- **API pihak ketiga belum siap**: Gunakan sandbox/mock dan jadwalkan integrasi final setelah credential tersedia.
- **Perubahan scope**: Semua tambahan fitur dicatat sebagai change request dan diestimasi ulang.
- **Transaksi keuangan rawan selisih**: Gunakan ledger immutable dan audit log, testing menyeluruh untuk payment flow.
- **Dispute/refund butuh keputusan bisnis**: Sediakan tool admin, tetapi SOP operasional harus dibuat klien.
- **OTP/WA blast bergantung provider**: Buat provider adapter dan retry log, siapkan fallback provider.
- **Mobile app review Apple/Google**: Siapkan konten dan policy sesuai guideline, estimasi 1-2 minggu untuk review process.
- **Performance bottleneck**: Database indexing, caching dengan Redis, load testing sebelum production.
- **Security vulnerability**: Regular security audit, dependency update, rate limiting, input validation.

## Opsi Deployment

### Option 1: Single VPS (Cost-Effective)
- Backend API, Web App, Admin Panel, PostgreSQL, Redis dalam satu VPS.
- Nginx sebagai reverse proxy.
- Docker Compose untuk orchestration.
- Cocok untuk MVP dan traffic rendah-menengah.

### Option 2: Separated Services (Scalable)
- Backend API di VPS terpisah atau cloud (DigitalOcean App Platform, Railway, Fly.io).
- Database managed service (Supabase, Neon, DigitalOcean Managed Database).
- Web App di Vercel/Netlify (CDN, auto-scaling).
- Mobile app di App Store dan Google Play Store.
- Cocok untuk traffic tinggi dan scaling horizontal.

## Maintenance dan Support

- **Bug fixing**: 1-2 bulan setelah deployment (included dalam project).
- **Feature request**: Diestimasi terpisah sebagai change request.
- **Monthly maintenance**: Rp 500.000 - Rp 1.500.000 per bulan (server monitoring, dependency update, minor bug fix).
- **SLA**: Response time 24 jam untuk bug kritikal, 48 jam untuk bug non-kritikal.


## Branch Strategy & Conventions

### Branches
- `main` — production-ready, always deployable to https://demo.viber.id (preview env). Protected.
- `feat/MAS-<n>-<slug>` — one branch per Linear issue. Created automatically by CERDAS pipeline.
- `fix/MAS-<n>-<slug>` — bugfix branches (manual).
- `chore/<scope>` — non-feature housekeeping.
- `release/<version>` — release stabilization (when needed).

### Workflow
1. CERDAS picks Backlog issue → creates `feat/MAS-<n>-<slug>` from `main`.
2. Coder commits work to branch.
3. Tester + reviewer pass → merge `--no-ff` into `main`.
4. Push `main` → CI/CD deploys to demo.viber.id (npm run build + restart).
5. Linear issue → Done. Branch deleted local + remote.

### Commit Convention (Conventional Commits)
Format: `<type>(<scope>): <subject>`

Types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `style`, `perf`, `build`, `ci`.

Examples:
- `feat(MAS-16): add Prisma schema for User + Order`
- `fix(MAS-22): handle expired OTP edge case`
- `docs(MAS-15): write ADR-001 stack selection`
- `chore(MAS-14): add .editorconfig + branch strategy`

Always include Linear issue ID `MAS-<n>` as the scope when applicable. The pipeline does this automatically.

### Tags
Releases tagged `v<major>.<minor>.<patch>` on `main` after milestones (Foundation, Auth-MVP, Marketplace-MVP, Wallet-MVP, GA).

### Protected Files
- `.env`, `.env.*` — never commit
- `node_modules/`, `.next/`, `dist/`, `build/` — gitignored
- Linear API keys, GitHub tokens, Midtrans/KiriminAja keys — only in `~/.hermes-coding/.env` on VPS

### Hot-fix Policy
For production incidents:
1. Branch from `main`: `fix/HOTFIX-<short-desc>`
2. Patch + test
3. Fast-forward merge to `main`, deploy
4. Backfill Linear issue retroactively with `MAS-` number
