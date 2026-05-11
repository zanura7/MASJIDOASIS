import { beforeEach, describe, expect, it } from "vitest";

import { CategoryError, CategoryService, type CategoryRow, type CategoryStore } from "./category-service";

/**
 * In-memory CategoryStore double — mirrors the Prisma surface this
 * service uses. Mutations build new objects so callers can't mutate
 * internals by reference.
 */
function createMemStore(): CategoryStore & { _rows: CategoryRow[] } {
  const rows: CategoryRow[] = [];
  let idSeq = 0;
  const nextId = () => `cat_${++idSeq}`;
  const clone = (r: CategoryRow): CategoryRow => ({ ...r });

  return {
    _rows: rows,
    category: {
      async findMany(args) {
        let out = rows.slice();
        if (args.where?.deletedAt === null) {
          out = out.filter((r) => r.deletedAt === null);
        }
        if (args.orderBy?.name === "asc") out.sort((a, b) => a.name.localeCompare(b.name));
        if (args.orderBy?.name === "desc") out.sort((a, b) => b.name.localeCompare(a.name));
        return out.map(clone);
      },
      async findUnique(args) {
        const r = rows.find(
          (row) =>
            (args.where.id !== undefined && row.id === args.where.id) ||
            (args.where.slug !== undefined && row.slug === args.where.slug),
        );
        return r ? clone(r) : null;
      },
      async create(args) {
        const now = new Date();
        const row: CategoryRow = {
          id: nextId(),
          name: args.data.name,
          slug: args.data.slug,
          parentId: args.data.parentId ?? null,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        };
        rows.push(row);
        return clone(row);
      },
      async update(args) {
        const idx = rows.findIndex((r) => r.id === args.where.id);
        if (idx < 0) throw new Error("not found");
        const existing = rows[idx]!;
        const merged: CategoryRow = {
          ...existing,
          ...args.data,
          updatedAt: new Date(),
        };
        rows[idx] = merged;
        return clone(merged);
      },
    },
  };
}

describe("CategoryService", () => {
  let store: ReturnType<typeof createMemStore>;
  let svc: CategoryService;
  beforeEach(() => {
    store = createMemStore();
    svc = new CategoryService({ db: store, rng: () => 0.42 });
  });

  describe("createCategory", () => {
    it("derives slug from name", async () => {
      const cat = await svc.createCategory({ name: "Kurma & Madu" });
      expect(cat.slug).toBe("kurma-madu");
      expect(cat.name).toBe("Kurma & Madu");
      expect(cat.deletedAt).toBeNull();
    });
    it("trims name whitespace", async () => {
      const cat = await svc.createCategory({ name: "  Susu Kambing  " });
      expect(cat.name).toBe("Susu Kambing");
      expect(cat.slug).toBe("susu-kambing");
    });
    it("accepts explicit slug", async () => {
      const cat = await svc.createCategory({ name: "Aneka Snack", slug: "snack-halal" });
      expect(cat.slug).toBe("snack-halal");
    });
    it("rejects empty name", async () => {
      await expect(svc.createCategory({ name: "" })).rejects.toMatchObject({
        code: "INVALID_INPUT",
        httpStatus: 400,
      });
      await expect(svc.createCategory({ name: "   " })).rejects.toMatchObject({
        code: "INVALID_INPUT",
      });
    });
    it("rejects 121-char name", async () => {
      await expect(svc.createCategory({ name: "a".repeat(121) })).rejects.toMatchObject({
        code: "INVALID_INPUT",
      });
    });
    it("retries with random suffix when natural slug collides", async () => {
      await svc.createCategory({ name: "Kurma" });
      const second = await svc.createCategory({ name: "Kurma" });
      expect(second.slug).not.toBe("kurma");
      expect(second.slug.startsWith("kurma-")).toBe(true);
    });
    it("returns 409 when explicit slug collides", async () => {
      await svc.createCategory({ name: "Kurma" });
      await expect(
        svc.createCategory({ name: "Kurma Premium", slug: "kurma" }),
      ).rejects.toMatchObject({ code: "SLUG_CONFLICT", httpStatus: 409 });
    });
    it("rejects unknown parent", async () => {
      await expect(
        svc.createCategory({ name: "Sub", parentId: "cat_999" }),
      ).rejects.toMatchObject({ code: "INVALID_PARENT" });
    });
    it("accepts known parent", async () => {
      const parent = await svc.createCategory({ name: "Makanan" });
      const child = await svc.createCategory({ name: "Kurma", parentId: parent.id });
      expect(child.parentId).toBe(parent.id);
    });
    it("rejects deleted parent", async () => {
      const parent = await svc.createCategory({ name: "Makanan" });
      await svc.softDeleteCategory(parent.id);
      await expect(
        svc.createCategory({ name: "Kurma", parentId: parent.id }),
      ).rejects.toMatchObject({ code: "INVALID_PARENT" });
    });
  });

  describe("listCategories", () => {
    it("excludes soft-deleted by default", async () => {
      const a = await svc.createCategory({ name: "Aaa" });
      await svc.createCategory({ name: "Bbb" });
      await svc.softDeleteCategory(a.id);
      const list = await svc.listCategories();
      expect(list).toHaveLength(1);
      expect(list[0]?.name).toBe("Bbb");
    });
    it("includes soft-deleted with flag", async () => {
      const a = await svc.createCategory({ name: "Aaa" });
      await svc.softDeleteCategory(a.id);
      const list = await svc.listCategories({ includeDeleted: true });
      expect(list).toHaveLength(1);
    });
  });

  describe("updateCategory", () => {
    it("updates name and slug", async () => {
      const cat = await svc.createCategory({ name: "Kurma" });
      const updated = await svc.updateCategory(cat.id, { name: "Kurma Ajwa", slug: "kurma-ajwa" });
      expect(updated.name).toBe("Kurma Ajwa");
      expect(updated.slug).toBe("kurma-ajwa");
    });
    it("rejects update of unknown id", async () => {
      await expect(svc.updateCategory("missing", { name: "x" })).rejects.toMatchObject({
        code: "NOT_FOUND",
        httpStatus: 404,
      });
    });
    it("rejects update of deleted category", async () => {
      const cat = await svc.createCategory({ name: "Tmp" });
      await svc.softDeleteCategory(cat.id);
      await expect(svc.updateCategory(cat.id, { name: "Renamed" })).rejects.toMatchObject({
        code: "DELETED",
        httpStatus: 410,
      });
    });
    it("rejects slug collision with another category", async () => {
      const a = await svc.createCategory({ name: "Alpha" });
      const b = await svc.createCategory({ name: "Beta" });
      await expect(svc.updateCategory(b.id, { slug: a.slug })).rejects.toMatchObject({
        code: "SLUG_CONFLICT",
      });
    });
    it("allows updating slug to same value (no-op rename)", async () => {
      const a = await svc.createCategory({ name: "Alpha" });
      const updated = await svc.updateCategory(a.id, { slug: a.slug });
      expect(updated.slug).toBe(a.slug);
    });
    it("rejects self-parent", async () => {
      const a = await svc.createCategory({ name: "Alpha" });
      await expect(svc.updateCategory(a.id, { parentId: a.id })).rejects.toMatchObject({
        code: "INVALID_PARENT",
      });
    });
  });

  describe("softDeleteCategory", () => {
    it("sets deletedAt", async () => {
      const cat = await svc.createCategory({ name: "Tmp" });
      const out = await svc.softDeleteCategory(cat.id);
      expect(out.deletedAt).toBeInstanceOf(Date);
    });
    it("is idempotent", async () => {
      const cat = await svc.createCategory({ name: "Tmp" });
      const first = await svc.softDeleteCategory(cat.id);
      const second = await svc.softDeleteCategory(cat.id);
      expect(second.deletedAt?.getTime()).toBe(first.deletedAt?.getTime());
    });
    it("404s on missing id", async () => {
      await expect(svc.softDeleteCategory("nope")).rejects.toBeInstanceOf(CategoryError);
    });
  });
});
