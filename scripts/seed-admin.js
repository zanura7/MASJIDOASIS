const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedUser() {
  const adminPhone = "+628111222333";
  
  const existingAdmin = await prisma.user.findUnique({
    where: { phone: adminPhone }
  });

  if (!existingAdmin) {
    const user = await prisma.user.create({
      data: {
        phone: adminPhone,
        name: "Super Admin",
        role: "ADMIN",
        status: "ACTIVE",
        phoneVerifiedAt: new Date()
      }
    });
    console.log("Admin user created:", user);
  } else {
    console.log("Admin user already exists:", existingAdmin);
  }
}

seedUser()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
