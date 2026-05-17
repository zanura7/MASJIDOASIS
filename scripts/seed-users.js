/**
 * Seed realistic users for MASJIDOASIS staging.
 *
 * Roles: ADMIN, SELLER, USTADZ, DOKTER, MEMBER
 * Phone numbers are fictional Indonesian format (+6281xxx).
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const users = [
  // === ADMIN ===
  {
    phone: "+6281100000001",
    name: "Adi Wardana",
    email: "admin@masjidoasis.id",
    role: "ADMIN",
  },

  // === USTADZ ===
  {
    phone: "+6281200000001",
    name: "Ustadz Ahmad Fauzi",
    email: "ustadz.fauzi@masjidoasis.id",
    role: "USTADZ",
  },
  {
    phone: "+6281200000002",
    name: "Ustadz Rizki Hidayat",
    email: "ustadz.rizki@masjidoasis.id",
    role: "USTADZ",
  },

  // === DOKTER ===
  {
    phone: "+6281300000001",
    name: "dr. Siti Nurhaliza",
    email: "dr.siti@masjidoasis.id",
    role: "DOKTER",
  },

  // === SELLER ===
  {
    phone: "+6281400000001",
    name: "Toko Busana Muslim Al-Ikhlas",
    email: "alikhlas@masjidoasis.id",
    role: "SELLER",
  },
  {
    phone: "+6281400000002",
    name: "Herbal Thibbun Nabawi",
    email: "herbal.thibbun@masjidoasis.id",
    role: "SELLER",
  },
  {
    phone: "+6281400000003",
    name: "Toko Buku Islami Ar-Rahmah",
    email: "arrahmah.book@masjidoasis.id",
    role: "SELLER",
  },

  // === MEMBER (jamaah) ===
  {
    phone: "+6281500000001",
    name: "Budi Santoso",
    role: "MEMBER",
  },
  {
    phone: "+6281500000002",
    name: "Fatimah Azzahra",
    role: "MEMBER",
  },
  {
    phone: "+6281500000003",
    name: "Hasan Basri",
    role: "MEMBER",
  },
  {
    phone: "+6281500000004",
    name: "Aisyah Putri",
    role: "MEMBER",
  },
  {
    phone: "+6281500000005",
    name: "Muhammad Rizal",
    role: "MEMBER",
  },
  {
    phone: "+6281500000006",
    name: "Dewi Rahmawati",
    role: "MEMBER",
  },
  {
    phone: "+6281500000007",
    name: "Abdullah Rahman",
    role: "MEMBER",
  },
  {
    phone: "+6281500000008",
    name: "Nur Aini",
    role: "MEMBER",
  },
];

async function seed() {
  let created = 0;
  let skipped = 0;

  for (const u of users) {
    const exists = await prisma.user.findUnique({ where: { phone: u.phone } });
    if (exists) {
      console.log(`  SKIP  ${u.role.padEnd(7)} ${u.name} (already exists)`);
      skipped++;
      continue;
    }
    await prisma.user.create({
      data: {
        phone: u.phone,
        name: u.name,
        email: u.email ?? null,
        role: u.role,
        status: "ACTIVE",
        phoneVerifiedAt: new Date(),
      },
    });
    console.log(`  ✓     ${u.role.padEnd(7)} ${u.name}`);
    created++;
  }

  // Create SYSTEM wallet account (required for ledger)
  const systemAcct = await prisma.walletAccount.findFirst({
    where: { type: "SYSTEM", userId: null },
  });
  if (!systemAcct) {
    await prisma.walletAccount.create({
      data: {
        type: "SYSTEM",
        currency: "IDR",
        balanceCents: BigInt(0),
      },
    });
    console.log("\n  ✓     SYSTEM wallet account created");
  }

  // Create PLATFORM_FEE wallet account
  const feeAcct = await prisma.walletAccount.findFirst({
    where: { type: "PLATFORM_FEE", userId: null },
  });
  if (!feeAcct) {
    await prisma.walletAccount.create({
      data: {
        type: "PLATFORM_FEE",
        currency: "IDR",
        balanceCents: BigInt(0),
      },
    });
    console.log("  ✓     PLATFORM_FEE wallet account created");
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped.`);

  // Summary
  const counts = await prisma.user.groupBy({
    by: ["role"],
    _count: true,
  });
  console.log("\nUser summary:");
  for (const c of counts) {
    console.log(`  ${c.role.padEnd(7)} : ${c._count}`);
  }
}

seed()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
