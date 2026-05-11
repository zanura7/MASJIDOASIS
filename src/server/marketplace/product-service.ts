/**
 * ProductService — MAS-31.
 *
 * Seller-scoped product CRUD. Sellers can only mutate their own
 * products; admins can override ownership checks. Listing is public
 * for ACTIVE status; sellers and admins see DRAFT/ARCHIVED too.
 *
 * Slug uniqueness is GLOBAL (matches Prisma `@unique`). On natural
 * collision the service retries with a random suffix.
 *
 * Errors thrown as `ProductError` with code + HTTP status.
 */

import { slugify, withRandomSuffix } from "./slug";

export type ProductStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export interface ProductRow {
  id: string;
  sellerId: string;
  categoryId: string | null;
  slug: string;
  title: string;
  description: string;
  priceCents: number;
  currency: string;
  stock: number;
  weightGram: number;
  images: string[];
  status: ProductStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CategoryLookup {
  id: string;
  deletedAt: Date | null;
}

export interface ProductStore {
  product: {
    findMany(args: {
      where?: {
        deletedAt?: { equals: Date | null } | null;
        sellerId?: string;
        categoryId?: string | null;
        status?: ProductStatus | { in: ProductStatus[] };
      };
      orderBy?: { createdAt: "asc" | "desc" };
      take?: number;
      skip?: number;
    }): Promise<ProductRow[]>;
    findUnique(args: { where: { id?: string; slug?: string } }): Promise<ProductRow | null>;
    create(args: {
      data: {
        sellerId: string;
        categoryId: string | null;
        slug: string;
        title: string;
        description: string;
        priceCents: number;
        currency: string;
        stock: number;
        weightGram: number;
        images: string[];
        status: ProductStatus;
      };
    }): Promise<ProductRow>;
    update(args: {
      where: { id: string };
      data: Partial<
        Pick<
          ProductRow,
          | "title"
          | "description"
          | "slug"
          | "priceCents"
          | "currency"
          | "stock"
          | "weightGram"
          | "images"
          | "status"
          | "categoryId"
          | "deletedAt"
        >
      >;
    }): Promise<ProductRow>;
  };
  category: {
    findUnique(args: { where: { id: string } }): Promise<CategoryLookup | null>;
  };
}

export type ProductErrorCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "SLUG_CONFLICT"
  | "INVALID_INPUT"
  | "INVALID_CATEGORY"
  | "DELETED";

export class ProductError extends Error {
  readonly code: ProductErrorCode;
  readonly httpStatus: number;
  constructor(code: ProductErrorCode, httpStatus: number, message: string) {
    super(message);
    this.name = "ProductError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export interface CreateProductInput {
  title: string;
  description: string;
  priceCents: number;
  slug?: string;
  currency?: string;
  stock?: number;
  weightGram?: number;
  images?: string[];
  status?: ProductStatus;
  categoryId?: string | null;
}

export interface UpdateProductInput {
  title?: string;
  description?: string;
  slug?: string;
  priceCents?: number;
  currency?: string;
  stock?: number;
  weightGram?: number;
  images?: string[];
  status?: ProductStatus;
  categoryId?: string | null;
}

export interface ListProductsFilter {
  sellerId?: string;
  categoryId?: string;
  status?: ProductStatus;
  /** When viewer is anonymous or buyer, default → only ACTIVE rows. */
  viewer?: { role: "PUBLIC" | "OWNER" | "ADMIN"; sellerId?: string };
  /** 1-based page index. */
  page?: number;
  /** Page size; clamped to 100. */
  pageSize?: number;
}

export interface ProductServiceOptions {
  db: ProductStore;
  rng?: () => number;
  slugRetryLimit?: number;
}

const MAX_PRICE_CENTS = 100_000_000_000; // 1 trillion IDR cents — sanity cap
const MAX_STOCK = 1_000_000;
const MAX_WEIGHT_GRAM = 1_000_000;
const MAX_IMAGES = 12;
const VALID_STATUS: ProductStatus[] = ["DRAFT", "ACTIVE", "ARCHIVED"];

function isStatus(v: unknown): v is ProductStatus {
  return typeof v === "string" && (VALID_STATUS as string[]).includes(v);
}

function validatePriceCents(v: unknown): number {
  if (typeof v !== "number" || !Number.isInteger(v)) {
    throw new ProductError("INVALID_INPUT", 400, "priceCents must be an integer");
  }
  if (v < 0) throw new ProductError("INVALID_INPUT", 400, "priceCents must be ≥ 0");
  if (v > MAX_PRICE_CENTS) {
    throw new ProductError("INVALID_INPUT", 400, "priceCents exceeds maximum");
  }
  return v;
}

function validateInt(name: string, v: unknown, max: number): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0) {
    throw new ProductError("INVALID_INPUT", 400, `${name} must be a non-negative integer`);
  }
  if (v > max) throw new ProductError("INVALID_INPUT", 400, `${name} exceeds maximum`);
  return v;
}

function validateImages(imgs: unknown): string[] {
  if (!Array.isArray(imgs)) {
    throw new ProductError("INVALID_INPUT", 400, "images must be an array of URLs");
  }
  if (imgs.length > MAX_IMAGES) {
    throw new ProductError("INVALID_INPUT", 400, `images must be ≤ ${MAX_IMAGES} URLs`);
  }
  for (const u of imgs) {
    if (typeof u !== "string" || u.trim() === "") {
      throw new ProductError("INVALID_INPUT", 400, "image URL must be non-empty string");
    }
    if (u.length > 2048) {
      throw new ProductError("INVALID_INPUT", 400, "image URL too long");
    }
  }
  return imgs as string[];
}

export class ProductService {
  private readonly db: ProductStore;
  private readonly rng: () => number;
  private readonly slugRetryLimit: number;

  constructor(opts: ProductServiceOptions) {
    this.db = opts.db;
    this.rng = opts.rng ?? Math.random;
    this.slugRetryLimit = opts.slugRetryLimit ?? 5;
  }

  async listProducts(filter: ListProductsFilter = {}): Promise<ProductRow[]> {
    const where: Parameters<ProductStore["product"]["findMany"]>[0]["where"] = {
      deletedAt: null,
    };
    if (filter.sellerId) where.sellerId = filter.sellerId;
    if (filter.categoryId) where.categoryId = filter.categoryId;

    const viewer = filter.viewer ?? { role: "PUBLIC" };
    if (filter.status) {
      // Explicit status filter — must be visible to viewer.
      if (
        viewer.role === "PUBLIC" &&
        filter.status !== "ACTIVE"
      ) {
        throw new ProductError("FORBIDDEN", 403, "non-active status requires authentication");
      }
      if (
        viewer.role === "OWNER" &&
        filter.sellerId &&
        filter.sellerId !== viewer.sellerId
      ) {
        throw new ProductError("FORBIDDEN", 403, "cannot view other sellers' non-active products");
      }
      where.status = filter.status;
    } else if (viewer.role === "PUBLIC") {
      where.status = "ACTIVE";
    } else if (viewer.role === "OWNER" && filter.sellerId !== viewer.sellerId) {
      // Owner browsing another seller — restrict to ACTIVE.
      where.status = "ACTIVE";
    }
    const pageSize = Math.min(Math.max(filter.pageSize ?? 20, 1), 100);
    const page = Math.max(filter.page ?? 1, 1);
    return this.db.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip: (page - 1) * pageSize,
    });
  }

  async getProductById(id: string): Promise<ProductRow | null> {
    return this.db.product.findUnique({ where: { id } });
  }

  async getProductBySlug(slug: string): Promise<ProductRow | null> {
    return this.db.product.findUnique({ where: { slug } });
  }

  async createProduct(sellerId: string, input: CreateProductInput): Promise<ProductRow> {
    if (typeof sellerId !== "string" || sellerId.trim() === "") {
      throw new ProductError("INVALID_INPUT", 400, "sellerId required");
    }
    if (typeof input.title !== "string" || input.title.trim() === "") {
      throw new ProductError("INVALID_INPUT", 400, "title is required");
    }
    if (input.title.length > 200) {
      throw new ProductError("INVALID_INPUT", 400, "title must be ≤ 200 chars");
    }
    if (typeof input.description !== "string") {
      throw new ProductError("INVALID_INPUT", 400, "description is required");
    }
    if (input.description.length > 10_000) {
      throw new ProductError("INVALID_INPUT", 400, "description must be ≤ 10 000 chars");
    }
    const priceCents = validatePriceCents(input.priceCents);
    const stock = validateInt("stock", input.stock ?? 0, MAX_STOCK);
    const weightGram = validateInt("weightGram", input.weightGram ?? 0, MAX_WEIGHT_GRAM);
    const images = validateImages(input.images ?? []);
    const status = input.status ?? "DRAFT";
    if (!isStatus(status)) {
      throw new ProductError("INVALID_INPUT", 400, "status must be DRAFT|ACTIVE|ARCHIVED");
    }
    const currency = (input.currency ?? "IDR").toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new ProductError("INVALID_INPUT", 400, "currency must be a 3-letter ISO code");
    }

    let categoryId: string | null = null;
    if (input.categoryId) {
      const cat = await this.db.category.findUnique({ where: { id: input.categoryId } });
      if (!cat) throw new ProductError("INVALID_CATEGORY", 400, "category not found");
      if (cat.deletedAt) throw new ProductError("INVALID_CATEGORY", 400, "category is deleted");
      categoryId = cat.id;
    }

    let slug: string;
    try {
      slug = input.slug ? slugify(input.slug) : slugify(input.title);
    } catch {
      throw new ProductError("INVALID_INPUT", 400, "slug could not be derived from title");
    }

    let attempt = 0;
    let candidate = slug;
    while (attempt <= this.slugRetryLimit) {
      const existing = await this.db.product.findUnique({ where: { slug: candidate } });
      if (!existing) {
        return this.db.product.create({
          data: {
            sellerId,
            categoryId,
            slug: candidate,
            title: input.title.trim(),
            description: input.description,
            priceCents,
            currency,
            stock,
            weightGram,
            images,
            status,
          },
        });
      }
      if (input.slug && attempt === 0) {
        throw new ProductError("SLUG_CONFLICT", 409, `slug "${candidate}" is taken`);
      }
      candidate = withRandomSuffix(slug, 5, this.rng);
      attempt++;
    }
    throw new ProductError("SLUG_CONFLICT", 409, "could not generate unique slug");
  }

  /**
   * Update by id with caller's effective principal. Sellers may only
   * update their own products; admins bypass the owner check.
   */
  async updateProduct(
    id: string,
    patch: UpdateProductInput,
    actor: { sellerId: string; role: "SELLER" | "ADMIN" },
  ): Promise<ProductRow> {
    const existing = await this.db.product.findUnique({ where: { id } });
    if (!existing) throw new ProductError("NOT_FOUND", 404, "product not found");
    if (existing.deletedAt) throw new ProductError("DELETED", 410, "product is deleted");
    if (actor.role !== "ADMIN" && existing.sellerId !== actor.sellerId) {
      throw new ProductError("FORBIDDEN", 403, "not the seller of this product");
    }

    const data: Parameters<ProductStore["product"]["update"]>[0]["data"] = {};
    if (patch.title !== undefined) {
      if (typeof patch.title !== "string" || patch.title.trim() === "") {
        throw new ProductError("INVALID_INPUT", 400, "title must be non-empty");
      }
      if (patch.title.length > 200) {
        throw new ProductError("INVALID_INPUT", 400, "title must be ≤ 200 chars");
      }
      data.title = patch.title.trim();
    }
    if (patch.description !== undefined) {
      if (typeof patch.description !== "string") {
        throw new ProductError("INVALID_INPUT", 400, "description must be string");
      }
      if (patch.description.length > 10_000) {
        throw new ProductError("INVALID_INPUT", 400, "description must be ≤ 10 000 chars");
      }
      data.description = patch.description;
    }
    if (patch.slug !== undefined) {
      let s: string;
      try {
        s = slugify(patch.slug);
      } catch {
        throw new ProductError("INVALID_INPUT", 400, "slug invalid");
      }
      const dup = await this.db.product.findUnique({ where: { slug: s } });
      if (dup && dup.id !== id) {
        throw new ProductError("SLUG_CONFLICT", 409, `slug "${s}" is taken`);
      }
      data.slug = s;
    }
    if (patch.priceCents !== undefined) data.priceCents = validatePriceCents(patch.priceCents);
    if (patch.stock !== undefined) data.stock = validateInt("stock", patch.stock, MAX_STOCK);
    if (patch.weightGram !== undefined) {
      data.weightGram = validateInt("weightGram", patch.weightGram, MAX_WEIGHT_GRAM);
    }
    if (patch.images !== undefined) data.images = validateImages(patch.images);
    if (patch.currency !== undefined) {
      const c = patch.currency.toUpperCase();
      if (!/^[A-Z]{3}$/.test(c)) {
        throw new ProductError("INVALID_INPUT", 400, "currency must be 3-letter ISO");
      }
      data.currency = c;
    }
    if (patch.status !== undefined) {
      if (!isStatus(patch.status)) {
        throw new ProductError("INVALID_INPUT", 400, "status must be DRAFT|ACTIVE|ARCHIVED");
      }
      data.status = patch.status;
    }
    if (patch.categoryId !== undefined) {
      if (patch.categoryId === null) {
        data.categoryId = null;
      } else {
        const cat = await this.db.category.findUnique({ where: { id: patch.categoryId } });
        if (!cat) throw new ProductError("INVALID_CATEGORY", 400, "category not found");
        if (cat.deletedAt) throw new ProductError("INVALID_CATEGORY", 400, "category deleted");
        data.categoryId = cat.id;
      }
    }
    return this.db.product.update({ where: { id }, data });
  }

  async softDeleteProduct(
    id: string,
    actor: { sellerId: string; role: "SELLER" | "ADMIN" },
  ): Promise<ProductRow> {
    const existing = await this.db.product.findUnique({ where: { id } });
    if (!existing) throw new ProductError("NOT_FOUND", 404, "product not found");
    if (actor.role !== "ADMIN" && existing.sellerId !== actor.sellerId) {
      throw new ProductError("FORBIDDEN", 403, "not the seller of this product");
    }
    if (existing.deletedAt) return existing; // idempotent
    return this.db.product.update({
      where: { id },
      data: { deletedAt: new Date(), status: "ARCHIVED" },
    });
  }
}
