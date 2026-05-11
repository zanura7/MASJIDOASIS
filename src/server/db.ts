import { PrismaClient } from "@prisma/client";

// Prisma client singleton — avoid exhausting DB connections during Next.js
// hot reload in development. See https://pris.ly/d/help/next-js-best-practices.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "production"
        ? ["error", "warn"]
        : ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
