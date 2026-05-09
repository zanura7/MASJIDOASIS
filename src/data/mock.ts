export const categories = ["Sembako", "Busana Muslim", "Buku", "Katering", "Jasa", "Donasi"];

export const products = [
  { id: "prd-1", name: "Paket Beras Jamaah 5kg", seller: "Koperasi Al-Ikhlas", price: "Rp 72.000", rating: "4.9", badge: "Terlaris", category: "Sembako", stock: 32 },
  { id: "prd-2", name: "Kurma Premium 500gr", seller: "Toko Barokah", price: "Rp 48.000", rating: "4.8", badge: "Halal", category: "Sembako", stock: 18 },
  { id: "prd-3", name: "Baju Koko Anak", seller: "Amanah Fashion", price: "Rp 89.000", rating: "4.7", badge: "Baru", category: "Busana Muslim", stock: 11 },
  { id: "prd-4", name: "Buku Sirah Nabawiyah", seller: "Pustaka Masjid", price: "Rp 64.000", rating: "4.9", badge: "Rekomendasi", category: "Buku", stock: 25 },
];

export const orders = [
  { id: "ORD-1021", title: "Paket Beras Jamaah", status: "Dikirim", date: "Hari ini", amount: "Rp 72.000", courier: "JNE REG", progress: 70 },
  { id: "ORD-1017", title: "Infaq Jumat Berkah", status: "Selesai", date: "Kemarin", amount: "Rp 100.000", courier: "Payment", progress: 100 },
  { id: "ORD-1015", title: "Kurma Premium 500gr", status: "Diproses", date: "2 hari lalu", amount: "Rp 48.000", courier: "Menunggu seller", progress: 35 },
];

export const feeds = [
  { id: "feed-1", type: "Kajian", title: "Adab Bermuamalah di Marketplace Muslim", time: "12 menit baca", speaker: "Ust. Ahmad Fauzi" },
  { id: "feed-2", type: "Video", title: "Tanya Jawab Fiqih Jual Beli Online", time: "18 menit", speaker: "Ust. Rahman" },
  { id: "feed-3", type: "Artikel", title: "Keutamaan Sedekah Subuh untuk Keluarga", time: "8 menit baca", speaker: "Tim Dakwah" },
];

export const campaigns = [
  { id: "cmp-1", title: "Renovasi Tempat Wudhu", collected: "Rp 18.500.000", target: "Rp 35.000.000", percent: 53 },
  { id: "cmp-2", title: "Santunan Yatim Bulanan", collected: "Rp 9.250.000", target: "Rp 15.000.000", percent: 62 },
  { id: "cmp-3", title: "Buka Puasa Senin Kamis", collected: "Rp 3.800.000", target: "Rp 6.000.000", percent: 63 },
];

export const stats = [
  { label: "Cart", value: "3 Item" },
  { label: "Order aktif", value: "2" },
  { label: "Donasi", value: "Rp 1,2jt" },
  { label: "Kajian dibaca", value: "18" },
];

export const profile = {
  name: "Adi Wardana",
  role: "Jamaah Aktif",
  phone: "+62 812 **** 255",
  email: "adi@example.com",
  address: "Jakarta Selatan",
  wallet: "Rp 250.000",
};


export const walletTransactions = [
  { id: "WLT-301", type: "Top Up", status: "Berhasil", date: "Hari ini", amount: "+Rp 250.000", note: "Top up via payment gateway" },
  { id: "WLT-300", type: "Escrow Order", status: "Ditahan", date: "Kemarin", amount: "-Rp 72.000", note: "Order Paket Beras Jamaah" },
  { id: "WLT-299", type: "Infaq", status: "Berhasil", date: "2 hari lalu", amount: "-Rp 100.000", note: "Infaq Jumat Berkah" },
];

export const events = [
  { id: "evt-1", title: "Kajian Ahad Pagi", date: "2026-05-10", time: "07:00 WIB", location: "Masjid Al-Ikhlas", speaker: "Ust. Ahmad Fauzi", category: "Kajian", status: "Aktif", registrants: 45, image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=800&auto=format&fit=crop" },
  { id: "evt-2", title: "Buka Puasa Bersama", date: "2026-05-15", time: "17:30 WIB", location: "Halaman Masjid", speaker: "Takmir Masjid", category: "Sosial", status: "Aktif", registrants: 120, image: "https://images.unsplash.com/photo-1581072551532-6804533039d9?q=80&w=800&auto=format&fit=crop" },
  { id: "evt-3", title: "Seminar Bisnis Syariah", date: "2026-06-01", time: "09:00 WIB", location: "Aula Serbaguna", speaker: "Ust. Rahman", category: "Edukasi", status: "Draft", registrants: 0, image: "https://images.unsplash.com/photo-1517048676732-d65bc937f952?q=80&w=800&auto=format&fit=crop" },
  { id: "evt-4", title: "Donor Darah & Cek Kesehatan", date: "2026-06-20", time: "08:00 WIB", location: "Parkir Masjid", speaker: "Dokter Hafidz", category: "Kesehatan", status: "Selesai", registrants: 67, image: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?q=80&w=800&auto=format&fit=crop" },
];

export const ustadzQuestions = [
  { id: "QA-210", category: "Muamalah", question: "Apakah jual beli online dengan sistem escrow diperbolehkan?", answer: "Boleh selama akad, barang, harga, dan mekanisme penitipan dana jelas serta tidak ada unsur gharar yang merugikan.", status: "Dijawab", ustadz: "Ust. Ahmad Fauzi" },
  { id: "QA-211", category: "Ibadah", question: "Bagaimana niat sedekah untuk orang tua yang sudah wafat?", answer: "Sedekah dapat diniatkan pahalanya untuk orang tua. InsyaAllah bermanfaat sebagai amal yang dihadiahkan.", status: "Dijawab", ustadz: "Ust. Rahman" },
  { id: "QA-212", category: "Kesehatan", question: "Apakah boleh konsultasi kesehatan di aplikasi komunitas masjid?", answer: "Menunggu jawaban dokter/ustadz yang ditugaskan.", status: "Menunggu", ustadz: "Belum ditugaskan" },
];

