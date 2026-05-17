import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Create admin user
  const admin = await prisma.user.upsert({
    where: { phone: '082140442025' },
    update: {},
    create: {
      phone: '082140442025',
      name: 'Admin Masjid Oasis Ar-Rahman',
      email: 'admin@masjidoasisarrahman.com',
      role: 'ADMIN',
      status: 'ACTIVE',
      phoneVerifiedAt: new Date(),
    },
  });
  console.log('✅ Admin user created:', admin.id);

  // 2. Create categories
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'makanan-minuman' },
      update: {},
      create: { slug: 'makanan-minuman', name: 'Makanan & Minuman' },
    }),
    prisma.category.upsert({
      where: { slug: 'fashion-muslim' },
      update: {},
      create: { slug: 'fashion-muslim', name: 'Fashion Muslim' },
    }),
    prisma.category.upsert({
      where: { slug: 'buku-islami' },
      update: {},
      create: { slug: 'buku-islami', name: 'Buku Islami' },
    }),
    prisma.category.upsert({
      where: { slug: 'perlengkapan-ibadah' },
      update: {},
      create: { slug: 'perlengkapan-ibadah', name: 'Perlengkapan Ibadah' },
    }),
  ]);
  console.log('✅ Categories created:', categories.length);

  // 3. Create sample products
  const products = await Promise.all([
    prisma.product.upsert({
      where: { slug: 'kurma-ajwa-madinah-500g' },
      update: {},
      create: {
        slug: 'kurma-ajwa-madinah-500g',
        title: 'Kurma Ajwa Madinah 500g',
        description: 'Kurma Ajwa premium dari Madinah. Kualitas terbaik, manis dan lembut.',
        priceCents: 15000000, // Rp 150.000
        currency: 'IDR',
        stock: 50,
        weightGram: 500,
        images: ['https://masjidoasisarrahman.com/_nuxt/logoRBG.D-nqWaUO.png'],
        status: 'ACTIVE',
        sellerId: admin.id,
        categoryId: categories[0].id,
      },
    }),
    prisma.product.upsert({
      where: { slug: 'sajadah-turki-premium' },
      update: {},
      create: {
        slug: 'sajadah-turki-premium',
        title: 'Sajadah Turki Premium',
        description: 'Sajadah import Turki dengan bahan lembut dan motif elegan.',
        priceCents: 25000000, // Rp 250.000
        currency: 'IDR',
        stock: 30,
        weightGram: 800,
        images: ['https://masjidoasisarrahman.com/_nuxt/logoRBG.D-nqWaUO.png'],
        status: 'ACTIVE',
        sellerId: admin.id,
        categoryId: categories[3].id,
      },
    }),
    prisma.product.upsert({
      where: { slug: 'al-quran-tajwid-terjemah' },
      update: {},
      create: {
        slug: 'al-quran-tajwid-terjemah',
        title: 'Al-Quran Tajwid & Terjemah',
        description: 'Al-Quran lengkap dengan tajwid warna dan terjemah Bahasa Indonesia.',
        priceCents: 12000000, // Rp 120.000
        currency: 'IDR',
        stock: 100,
        weightGram: 1200,
        images: ['https://masjidoasisarrahman.com/_nuxt/logoRBG.D-nqWaUO.png'],
        status: 'ACTIVE',
        sellerId: admin.id,
        categoryId: categories[2].id,
      },
    }),
  ]);
  console.log('✅ Products created:', products.length);

  // 4. Create campaigns (infaq/shadaqah)
  const campaigns = await Promise.all([
    prisma.campaign.upsert({
      where: { slug: 'renovasi-masjid-2026' },
      update: {},
      create: {
        slug: 'renovasi-masjid-2026',
        title: 'Renovasi Masjid Oasis Ar-Rahman 2026',
        description: `Assalamu'alaikum warahmatullahi wabarakatuh,

Masjid Oasis Ar-Rahman membutuhkan renovasi untuk meningkatkan kenyamanan jamaah. Target dana yang dibutuhkan adalah Rp 50.000.000 untuk:
- Perbaikan atap dan plafon
- Renovasi kamar mandi
- Pengecatan ulang
- Perbaikan sound system

Semoga Allah membalas kebaikan para donatur dengan pahala yang berlipat ganda. Aamiin.`,
        targetCents: BigInt("5000000000"), // Rp 50.000.000
        raisedCents: BigInt("1250000000"), // Rp 12.500.000 (25%)
        currency: 'IDR',
        status: 'ACTIVE',
        coverImage: 'https://masjidoasisarrahman.com/uploads/gallery/gallery_122_0_1767448841380_IMG_20260103_174138.jpg',
        startsAt: new Date('2026-01-01'),
        endsAt: new Date('2026-12-31'),
        ownerId: admin.id,
      },
    }),
    prisma.campaign.upsert({
      where: { slug: 'bantuan-yatim-piatu' },
      update: {},
      create: {
        slug: 'bantuan-yatim-piatu',
        title: 'Bantuan Yatim Piatu & Dhuafa',
        description: `Program rutin Masjid Oasis Ar-Rahman untuk membantu anak yatim piatu dan keluarga dhuafa di sekitar masjid.

Dana akan disalurkan untuk:
- Santunan bulanan
- Biaya pendidikan
- Paket sembako
- Bantuan kesehatan

"Barangsiapa yang mengusap kepala anak yatim, maka baginya setiap rambut yang diusapnya akan mendapat pahala." (HR. Ahmad)`,
        targetCents: BigInt("2000000000"), // Rp 20.000.000
        raisedCents: BigInt("850000000"), // Rp 8.500.000 (42.5%)
        currency: 'IDR',
        status: 'ACTIVE',
        coverImage: 'https://masjidoasisarrahman.com/uploads/gallery/gallery_128_2_1770604549748_IMG_20260209_092505.jpg',
        startsAt: new Date('2026-01-01'),
        endsAt: new Date('2026-12-31'),
        ownerId: admin.id,
      },
    }),
  ]);
  console.log('✅ Campaigns created:', campaigns.length);

  // 5. Create posts (dakwah content)
  const posts = await Promise.all([
    prisma.post.upsert({
      where: { slug: 'keutamaan-shalat-berjamaah' },
      update: {},
      create: {
        slug: 'keutamaan-shalat-berjamaah',
        kind: 'ARTICLE',
        title: 'Keutamaan Shalat Berjamaah di Masjid',
        body: `# Keutamaan Shalat Berjamaah di Masjid

Rasulullah ﷺ bersabda:

> "Shalat berjamaah lebih utama daripada shalat sendirian dengan 27 derajat." (HR. Bukhari & Muslim)

## Hikmah Shalat Berjamaah

1. **Meningkatkan Pahala** - Pahala berlipat ganda dibanding shalat sendiri
2. **Mempererat Ukhuwah** - Bertemu dan bersilaturahmi dengan sesama muslim
3. **Disiplin Waktu** - Melatih ketepatan waktu dalam beribadah
4. **Belajar Khusyuk** - Suasana masjid membantu konsentrasi dalam shalat

## Jadwal Shalat Berjamaah

Masjid Oasis Ar-Rahman membuka pintu untuk jamaah setiap waktu shalat. Mari ramaikan masjid dengan shalat berjamaah!

Jazakumullahu khairan.`,
        coverImage: 'https://masjidoasisarrahman.com/uploads/gallery/gallery_124_0_1768040773661_IMG_20260110_171401.jpg',
        status: 'PUBLISHED',
        publishedAt: new Date('2026-05-01'),
        authorId: admin.id,
      },
    }),
    prisma.post.upsert({
      where: { slug: 'kajian-tazkiyatun-nafs' },
      update: {},
      create: {
        slug: 'kajian-tazkiyatun-nafs',
        kind: 'ARTICLE',
        title: 'Kajian Rutin: Tazkiyatun Nafs (Penyucian Jiwa)',
        body: `# Kajian Rutin: Tazkiyatun Nafs

Masjid Oasis Ar-Rahman mengadakan kajian rutin **Tazkiyatun Nafs** (Penyucian Jiwa) bersama **Ust. Muhammad Sholeh Drehem, Lc., M.Ag.**

## Jadwal Kajian

- **Hari**: Setiap Rabu
- **Waktu**: Ba'da Maghrib
- **Tempat**: Masjid Oasis Ar-Rahman
- **Biaya**: GRATIS & Terbuka untuk Umum

## Tema Kajian

Kajian ini membahas tentang cara membersihkan hati dan jiwa dari penyakit-penyakit hati seperti:
- Riya (pamer)
- Ujub (bangga diri)
- Hasad (dengki)
- Ghibah (gunjing)

Dan bagaimana menggantinya dengan akhlak mulia.

## Fasilitas

✅ Tempat parkir luas  
✅ Mushaf Al-Quran tersedia  
✅ Toilet bersih  
✅ Ruang ber-AC

Yuk ikuti kajian rutin kami! Ajak keluarga dan teman-teman.

**Kontak**: 082140442025`,
        coverImage: 'https://masjidoasisarrahman.com/uploads/gallery/gallery_131_0_1771081264033_IMG_20260214_21412288.jpeg',
        status: 'PUBLISHED',
        publishedAt: new Date('2026-05-10'),
        authorId: admin.id,
      },
    }),
    prisma.post.upsert({
      where: { slug: 'sirah-nabawiyah-drs-lutfi' },
      update: {},
      create: {
        slug: 'sirah-nabawiyah-drs-lutfi',
        kind: 'ARTICLE',
        title: 'Kajian Sirah Nabawiyah Bersama Ust. Drs. Muhammad Lutfi',
        body: `# Kajian Sirah Nabawiyah

Belajar sejarah kehidupan Rasulullah ﷺ adalah kewajiban setiap muslim. Melalui sirah, kita belajar bagaimana Rasulullah menghadapi berbagai cobaan dan tantangan.

## Jadwal Kajian

- **Hari**: Setiap Ahad
- **Waktu**: Ba'da Ashar
- **Pengisi**: Ust. Drs. Muhammad Lutfi
- **Tempat**: Masjid Oasis Ar-Rahman

## Materi yang Dibahas

Kajian ini membahas perjalanan hidup Rasulullah ﷺ secara kronologis:
1. Kelahiran dan masa kecil
2. Periode Makkah (dakwah sembunyi & terang-terangan)
3. Hijrah ke Madinah
4. Perang-perang besar (Badar, Uhud, Khandaq, dll)
5. Fathu Makkah
6. Haji Wada' dan wafatnya Rasulullah ﷺ

Kajian ini sangat cocok untuk:
- Pemula yang ingin belajar Islam
- Orang tua yang ingin mengajarkan sirah kepada anak
- Siapa saja yang ingin meneladani Rasulullah ﷺ

**Mari ramaikan kajian rutin kita!**

Informasi: 082140442025`,
        coverImage: 'https://masjidoasisarrahman.com/uploads/gallery/gallery_120_0_1767161798977_IMG_20251231_12554403.jpeg',
        status: 'PUBLISHED',
        publishedAt: new Date('2026-05-15'),
        authorId: admin.id,
      },
    }),
  ]);
  console.log('✅ Posts created:', posts.length);

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
