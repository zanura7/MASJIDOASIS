/**
 * CategoryService — MAS-31.
 *
 * Thin domain layer over Prisma for category CRUD. Wraps the DB in a
 * small `CategoryStore` interface so route handlers and tests can swap
 * in a fake. Soft delete via `deletedAt`.
 *
 * Public API:
 *   - listCategories({ includeDeleted? })   → category[]
 *   - getCategoryBySlug(slug)               → category | null
 *   - createCategory({ name, slug?, parentId? })
 *   - updateCategory(id, patch)
 *   - softDeleteCategory(id)
 *
 * Errors thrown as `CategoryError` with a `code` discriminator + HTTP
 * status so route handlers can `try/catch` and serialise uniformly.
 */

import { slugify, withRandomSuffix } from "./slug";

export interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CategoryStore {
  category: {
    findMany(args: {
      where?: { deletedAt?: { equals: Date | null } | null };
      orderBy?: { name: "asc" | "desc" };
    }): Promise<CategoryRow[]>;
    findUnique(args: { where: { id?: string; slug?: string } }): Promise<CategoryRow | null>;
    create(args: {
      data: { name: string; slug: string; parentId?: string | null };
    }): Promise<CategoryRow>;
    update(args: {
      where: { id: string };
      data: Partial<Pick<CategoryRow, "name" | "slug" | "parentId" | "deletedAt">>;
    }): Promise<CategoryRow>;
  };
}

export type CategoryErrorCode =
  | "NOT_FOUND"
  | "SLUG_CONFLICT"
  | "INVALID_INPUT"
  | "INVALID_PARENT"
  | "DELETED";

export class CategoryError extends Error {
  readonly code: CategoryErrorCode;
  readonly httpStatus: number;
  constructor(code: CategoryErrorCode, httpStatus: number, message: string) {
    super(message);
    this.name = "CategoryError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export interface CreateCategoryInput {
  name: string;
  slug?: string;
  parentId?: string | null;
}

export interface UpdateCategoryInput {
  name?: string;
  slug?: string;
  parentId?: string | null;
}

export interface CategoryServiceOptions {
  db: CategoryStore;
  /** Override random source (used by tests). */
  rng?: () => number;
  /** Max slug-collision retries. */
  slugRetryLimit?: number;
}

export class CategoryService {
  private readonly db: CategoryStore;
  private readonly rng: () => number;
  private readonly slugRetryLimit: number;

  constructor(opts: CategoryServiceOptions) {
    this.db = opts.db;
    this.rng = opts.rng ?? Math.random;
    this.slugRetryLimit = opts.slugRetryLimit ?? 5;
  }

  async listCategories(opts: { includeDeleted?: boolean } = {}): Promise<CategoryRow[]> {
    return this.db.category.findMany({
      where: opts.includeDeleted ? undefined : { deletedAt: null },
      orderBy: { name: "asc" },
    });
  }

  async getCategoryBySlug(slug: string): Promise<CategoryRow | null> {
    if (typeof slug !== "string" || slug.trim() === "") {
      throw new CategoryError("INVALID_INPUT", 400, "slug is required");
    }
    return this.db.category.findUnique({ where: { slug } });
  }

  async getCategoryById(id: string): Promise<CategoryRow | null> {
    return this.db.category.findUnique({ where: { id } });
  }

  async createCategory(input: CreateCategoryInput): Promise<CategoryRow> {
    if (typeof input.name !== "string" || input.name.trim() === "") {
      throw new CategoryError("INVALID_INPUT", 400, "name is required");
    }
    if (input.name.length > 120) {
      throw new CategoryError("INVALID_INPUT", 400, "name must be ≤ 120 chars");
    }
    let slug: string;
    try {
      slug = input.slug ? slugify(input.slug) : slugify(input.name);
    } catch {
      throw new CategoryError("INVALID_INPUT", 400, "slug could not be derived from name");
    }

    if (input.parentId) {
      const parent = await this.db.category.findUnique({ where: { id: input.parentId } });
      if (!parent) {
        throw new CategoryError("INVALID_PARENT", 400, "parent category not found");
      }
      if (parent.deletedAt) {
        throw new CategoryError("INVALID_PARENT", 400, "parent category is deleted");
      }
    }

    // Slug uniqueness — retry up to `slugRetryLimit` with random suffix.
    let attempt = 0;
    let candidate = slug;
    while (attempt <= this.slugRetryLimit) {
      const existing = await this.db.category.findUnique({ where: { slug: candidate } });
      if (!existing) {
        return this.db.category.create({
          data: { name: input.name.trim(), slug: candidate, parentId: input.parentId ?? null },
        });
      }
      if (input.slug && attempt === 0) {
        // Caller supplied an explicit slug that already exists — surface 409.
        throw new CategoryError("SLUG_CONFLICT", 409, `slug "${candidate}" is taken`);
      }
      candidate = withRandomSuffix(slug, 5, this.rng);
      attempt++;
    }
    throw new CategoryError("SLUG_CONFLICT", 409, "could not generate unique slug");
  }

  async updateCategory(id: string, patch: UpdateCategoryInput): Promise<CategoryRow> {
    const existing = await this.db.category.findUnique({ where: { id } });
    if (!existing) throw new CategoryError("NOT_FOUND", 404, "category not found");
    if (existing.deletedAt) throw new CategoryError("DELETED", 410, "category is deleted");

    const data: Partial<Pick<CategoryRow, "name" | "slug" | "parentId">> = {};
    if (patch.name !== undefined) {
      if (typeof patch.name !== "string" || patch.name.trim() === "") {
        throw new CategoryError("INVALID_INPUT", 400, "name must be non-empty string");
      }
      if (patch.name.length > 120) {
        throw new CategoryError("INVALID_INPUT", 400, "name must be ≤ 120 chars");
      }
      data.name = patch.name.trim();
    }
    if (patch.slug !== undefined) {
      let s: string;
      try {
        s = slugify(patch.slug);
      } catch {
        throw new CategoryError("INVALID_INPUT", 400, "slug invalid");
      }
      const dup = await this.db.category.findUnique({ where: { slug: s } });
      if (dup && dup.id !== id) {
        throw new CategoryError("SLUG_CONFLICT", 409, `slug "${s}" is taken`);
      }
      data.slug = s;
    }
    if (patch.parentId !== undefined) {
      if (patch.parentId === id) {
        throw new CategoryError("INVALID_PARENT", 400, "category cannot be its own parent");
      }
      if (patch.parentId !== null) {
        const parent = await this.db.category.findUnique({ where: { id: patch.parentId } });
        if (!parent) throw new CategoryError("INVALID_PARENT", 400, "parent not found");
        if (parent.deletedAt) throw new CategoryError("INVALID_PARENT", 400, "parent is deleted");
      }
      data.parentId = patch.parentId;
    }
    return this.db.category.update({ where: { id }, data });
  }

  async softDeleteCategory(id: string): Promise<CategoryRow> {
    const existing = await this.db.category.findUnique({ where: { id } });
    if (!existing) throw new CategoryError("NOT_FOUND", 404, "category not found");
    if (existing.deletedAt) return existing; // idempotent
    return this.db.category.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
