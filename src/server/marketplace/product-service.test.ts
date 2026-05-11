import { beforeEach, describe, expect, it } from "vitest";

import {
  ProductError,
  ProductService,
  type CategoryLookup,
  type ProductRow,
  type ProductStore,
} from "./product-service";

/**
 * In-memory ProductStore double — mirrors only the slice of Prisma
 * ProductService touches. Categories are pre-seeded by the test.
 */
function createMemStore(): ProductStore & {
  _products: ProductRow[];
  _categories: CategoryLookup[];
  seedCategory: (id: string, deletedAt?: Date | null) => void;
} {
  const products: ProductRow[] = [];
  const categories: CategoryLookup[] = [];
  let idSeq = 0;
  const nextId = () => `prd_${++idSeq}`;
  const clone = (r: ProductRow): ProductRow => ({ ...r, images: r.images.slice() });

  return {
    _products: products,
    _categories: categories,
    seedCategory(id, deletedAt = null) {
      categories.push({ id, deletedAt });
    },
    product: {
      async findMany(args) {
        let out = products.slice();
        const w = args.where ?? {};
        if (w.deletedAt === null) out = out.filter((p) => p.deletedAt === null);
        if (w.sellerId !== undefined) out = out.filter((p) => p.sellerId === w.sellerId);
        if (w.categoryId !== undefined) out = out.filter((p) => p.categoryId === w.categoryId);
        if (w.status !== undefined) {
          const s = w.status;
          if (typeof s === "string") out = out.filter((p) => p.status === s);
          else out = out.filter((p) => s.in.includes(p.status));
        }
        if (args.orderBy?.createdAt === "desc") {
          out.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        if (args.orderBy?.createdAt === "asc") {
          out.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        }
        const skip = args.skip ?? 0;
        const take = args.take ?? out.length;
        return out.slice(skip, skip + take).map(clone);
      },
      async findUnique(args) {
        const p = products.find(
          (row) =>
            (args.where.id !== undefined && row.id === args.where.id) ||
            (args.where.slug !== undefined && row.slug === args.where.slug),
        );
        return p ? clone(p) : null;
      },
      async create(args) {
        const now = new Date(Date.now() + products.length); // unique timestamps
        const row: ProductRow = {
          id: nextId(),
          ...args.data,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        };
        products.push(row);
        return clone(row);
      },
      async update(args) {
        const idx = products.findIndex((p) => p.id === args.where.id);
        if (idx < 0) throw new Error("not found");
        const existing = products[idx]!;
        const merged: ProductRow = {
          ...existing,
          ...args.data,
          images: args.data.images ?? existing.images,
          updatedAt: new Date(),
        };
        products[idx] = merged;
        return clone(merged);
      },
    },
    category: {
      async findUnique(args) {
        const c = categories.find((cat) => cat.id === args.where.id);
        return c ? { ...c } : null;
      },
    },
  };
}

describe("ProductService", () => {
  let store: ReturnType<typeof createMemStore>;
  let svc: ProductService;
  beforeEach(() => {
    store = createMemStore();
    svc = new ProductService({ db: store, rng: () => 0.42 });
  });

  describe("createProduct", () => {
    it("creates a DRAFT product with sane defaults", async () => {
      const p = await svc.createProduct("seller_1", {
        title: "Kurma Ajwa 1kg",
        description: "Premium dates from Madinah",
        priceCents: 12_500_00,
      });
      expect(p.sellerId).toBe("seller_1");
      expect(p.title).toBe("Kurma Ajwa 1kg");
      expect(p.slug).toBe("kurma-ajwa-1kg");
      expect(p.status).toBe("DRAFT");
      expect(p.currency).toBe("IDR");
      expect(p.stock).toBe(0);
      expect(p.images).toEqual([]);
      expect(p.categoryId).toBeNull();
      expect(p.deletedAt).toBeNull();
    });
    it("validates priceCents non-negative integer", async () => {
      await expect(
        svc.createProduct("s1", { title: "x", description: "d", priceCents: -1 }),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
      await expect(
        svc.createProduct("s1", { title: "x", description: "d", priceCents: 1.5 }),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    });
    it("validates title length ≤ 200", async () => {
      await expect(
        svc.createProduct("s1", {
          title: "a".repeat(201),
          description: "",
          priceCents: 0,
        }),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    });
    it("validates images URL list ≤ 12 entries", async () => {
      await expect(
        svc.createProduct("s1", {
          title: "x",
          description: "",
          priceCents: 0,
          images: Array.from({ length: 13 }, (_, i) => `https://cdn.example.com/${i}.jpg`),
        }),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    });
    it("validates currency is 3-letter ISO", async () => {
      await expect(
        svc.createProduct("s1", {
          title: "x",
          description: "",
          priceCents: 0,
          currency: "RUPIAH",
        }),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    });
    it("validates status enum", async () => {
      await expect(
        svc.createProduct("s1", {
          title: "x",
          description: "",
          priceCents: 0,
          // @ts-expect-error — runtime check
          status: "BOGUS",
        }),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    });
    it("rejects unknown category", async () => {
      await expect(
        svc.createProduct("s1", {
          title: "x",
          description: "",
          priceCents: 0,
          categoryId: "cat_nope",
        }),
      ).rejects.toMatchObject({ code: "INVALID_CATEGORY" });
    });
    it("rejects deleted category", async () => {
      store.seedCategory("cat_dead", new Date());
      await expect(
        svc.createProduct("s1", {
          title: "x",
          description: "",
          priceCents: 0,
          categoryId: "cat_dead",
        }),
      ).rejects.toMatchObject({ code: "INVALID_CATEGORY" });
    });
    it("accepts valid category", async () => {
      store.seedCategory("cat_ok");
      const p = await svc.createProduct("s1", {
        title: "x",
        description: "",
        priceCents: 0,
        categoryId: "cat_ok",
      });
      expect(p.categoryId).toBe("cat_ok");
    });
    it("retries slug on collision", async () => {
      await svc.createProduct("s1", { title: "Kurma", description: "", priceCents: 0 });
      const second = await svc.createProduct("s2", {
        title: "Kurma",
        description: "",
        priceCents: 0,
      });
      expect(second.slug).not.toBe("kurma");
      expect(second.slug.startsWith("kurma-")).toBe(true);
    });
    it("409 on explicit slug collision", async () => {
      await svc.createProduct("s1", { title: "Kurma", description: "", priceCents: 0 });
      await expect(
        svc.createProduct("s2", { title: "Other", slug: "kurma", description: "", priceCents: 0 }),
      ).rejects.toMatchObject({ code: "SLUG_CONFLICT", httpStatus: 409 });
    });
  });

  describe("updateProduct", () => {
    it("seller can update own product", async () => {
      const p = await svc.createProduct("s1", {
        title: "Old",
        description: "d",
        priceCents: 1000,
      });
      const updated = await svc.updateProduct(
        p.id,
        { title: "New", priceCents: 2000, status: "ACTIVE" },
        { sellerId: "s1", role: "SELLER" },
      );
      expect(updated.title).toBe("New");
      expect(updated.priceCents).toBe(2000);
      expect(updated.status).toBe("ACTIVE");
    });
    it("seller cannot update other seller's product", async () => {
      const p = await svc.createProduct("s1", {
        title: "x",
        description: "d",
        priceCents: 1000,
      });
      await expect(
        svc.updateProduct(
          p.id,
          { title: "hacked" },
          { sellerId: "s2", role: "SELLER" },
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN", httpStatus: 403 });
    });
    it("admin can update any seller's product", async () => {
      const p = await svc.createProduct("s1", {
        title: "x",
        description: "d",
        priceCents: 1000,
      });
      const out = await svc.updateProduct(
        p.id,
        { status: "ARCHIVED" },
        { sellerId: "admin_user", role: "ADMIN" },
      );
      expect(out.status).toBe("ARCHIVED");
    });
    it("rejects slug collision with another product", async () => {
      const a = await svc.createProduct("s1", { title: "Alpha", description: "", priceCents: 0 });
      const b = await svc.createProduct("s1", { title: "Beta", description: "", priceCents: 0 });
      await expect(
        svc.updateProduct(b.id, { slug: a.slug }, { sellerId: "s1", role: "SELLER" }),
      ).rejects.toMatchObject({ code: "SLUG_CONFLICT" });
    });
    it("allows clearing category to null", async () => {
      store.seedCategory("cat_1");
      const p = await svc.createProduct("s1", {
        title: "x",
        description: "",
        priceCents: 0,
        categoryId: "cat_1",
      });
      const out = await svc.updateProduct(
        p.id,
        { categoryId: null },
        { sellerId: "s1", role: "SELLER" },
      );
      expect(out.categoryId).toBeNull();
    });
    it("404 on missing id", async () => {
      await expect(
        svc.updateProduct(
          "missing",
          { title: "x" },
          { sellerId: "s1", role: "SELLER" },
        ),
      ).rejects.toMatchObject({ code: "NOT_FOUND", httpStatus: 404 });
    });
    it("410 on deleted product", async () => {
      const p = await svc.createProduct("s1", { title: "x", description: "", priceCents: 0 });
      await svc.softDeleteProduct(p.id, { sellerId: "s1", role: "SELLER" });
      await expect(
        svc.updateProduct(p.id, { title: "y" }, { sellerId: "s1", role: "SELLER" }),
      ).rejects.toMatchObject({ code: "DELETED", httpStatus: 410 });
    });
  });

  describe("softDeleteProduct", () => {
    it("seller deletes own product → soft deleted + archived", async () => {
      const p = await svc.createProduct("s1", { title: "x", description: "", priceCents: 0 });
      const out = await svc.softDeleteProduct(p.id, { sellerId: "s1", role: "SELLER" });
      expect(out.deletedAt).toBeInstanceOf(Date);
      expect(out.status).toBe("ARCHIVED");
    });
    it("seller cannot delete other's product", async () => {
      const p = await svc.createProduct("s1", { title: "x", description: "", priceCents: 0 });
      await expect(
        svc.softDeleteProduct(p.id, { sellerId: "s2", role: "SELLER" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
    it("admin can delete any product", async () => {
      const p = await svc.createProduct("s1", { title: "x", description: "", priceCents: 0 });
      const out = await svc.softDeleteProduct(p.id, { sellerId: "any", role: "ADMIN" });
      expect(out.deletedAt).toBeInstanceOf(Date);
    });
    it("is idempotent", async () => {
      const p = await svc.createProduct("s1", { title: "x", description: "", priceCents: 0 });
      const first = await svc.softDeleteProduct(p.id, { sellerId: "s1", role: "SELLER" });
      const second = await svc.softDeleteProduct(p.id, { sellerId: "s1", role: "SELLER" });
      expect(second.deletedAt?.getTime()).toBe(first.deletedAt?.getTime());
    });
    it("404 on missing id", async () => {
      await expect(
        svc.softDeleteProduct("missing", { sellerId: "s1", role: "SELLER" }),
      ).rejects.toBeInstanceOf(ProductError);
    });
  });

  describe("listProducts", () => {
    it("public viewer sees only ACTIVE", async () => {
      const a = await svc.createProduct("s1", { title: "A", description: "", priceCents: 0 });
      await svc.createProduct("s1", { title: "B", description: "", priceCents: 0 });
      await svc.updateProduct(a.id, { status: "ACTIVE" }, { sellerId: "s1", role: "SELLER" });
      const list = await svc.listProducts();
      expect(list).toHaveLength(1);
      expect(list[0]?.status).toBe("ACTIVE");
    });
    it("owner sees all of own + only ACTIVE of others", async () => {
      const a = await svc.createProduct("s1", { title: "Own DRAFT", description: "", priceCents: 0 });
      void a;
      const b = await svc.createProduct("s2", { title: "Other ACTIVE", description: "", priceCents: 0 });
      await svc.updateProduct(b.id, { status: "ACTIVE" }, { sellerId: "s2", role: "SELLER" });
      await svc.createProduct("s2", { title: "Other DRAFT", description: "", priceCents: 0 });
      const own = await svc.listProducts({
        sellerId: "s1",
        viewer: { role: "OWNER", sellerId: "s1" },
      });
      expect(own.map((p) => p.title).sort()).toEqual(["Own DRAFT"]);
    });
    it("filters by sellerId + categoryId", async () => {
      store.seedCategory("c1");
      await svc.createProduct("s1", {
        title: "p1",
        description: "",
        priceCents: 0,
        categoryId: "c1",
        status: "ACTIVE",
      });
      await svc.createProduct("s1", {
        title: "p2",
        description: "",
        priceCents: 0,
        status: "ACTIVE",
      });
      const list = await svc.listProducts({ sellerId: "s1", categoryId: "c1" });
      expect(list).toHaveLength(1);
      expect(list[0]?.title).toBe("p1");
    });
    it("public cannot filter by non-ACTIVE status", async () => {
      await expect(
        svc.listProducts({ status: "DRAFT" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
    it("excludes soft-deleted by default", async () => {
      const p = await svc.createProduct("s1", {
        title: "p",
        description: "",
        priceCents: 0,
        status: "ACTIVE",
      });
      await svc.softDeleteProduct(p.id, { sellerId: "s1", role: "SELLER" });
      const list = await svc.listProducts();
      expect(list).toHaveLength(0);
    });
    it("paginates with page/pageSize", async () => {
      for (let i = 0; i < 5; i++) {
        await svc.createProduct("s1", {
          title: `p${i}`,
          description: "",
          priceCents: 0,
          status: "ACTIVE",
        });
      }
      const page1 = await svc.listProducts({ pageSize: 2, page: 1 });
      const page2 = await svc.listProducts({ pageSize: 2, page: 2 });
      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page1[0]?.id).not.toBe(page2[0]?.id);
    });
  });
});
