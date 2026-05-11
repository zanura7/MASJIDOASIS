/**
 * Marketplace route helpers — MAS-31.
 *
 * Shared serialisation and error mapping for `/api/categories` and
 * `/api/products`. Centralises:
 *   - converting domain rows to JSON-safe shapes (ISO dates)
 *   - mapping `CategoryError` / `ProductError` / `AuthError` to
 *     `{ status, body }` for `NextResponse.json`
 */

import { authErrorToJson, AuthError } from "@/server/auth/middleware";
import type { CategoryRow } from "./category-service";
import { CategoryError } from "./category-service";
import type { ProductRow } from "./product-service";
import { ProductError } from "./product-service";

export interface CategoryJson {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export function categoryToJson(row: CategoryRow): CategoryJson {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    parentId: row.parentId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

export interface ProductJson {
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
  status: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export function productToJson(row: ProductRow): ProductJson {
  return {
    id: row.id,
    sellerId: row.sellerId,
    categoryId: row.categoryId,
    slug: row.slug,
    title: row.title,
    description: row.description,
    priceCents: row.priceCents,
    currency: row.currency,
    stock: row.stock,
    weightGram: row.weightGram,
    images: row.images.slice(),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

export interface ErrorJsonResult {
  status: number;
  body: { ok: false; code: string; message: string };
}

export function marketplaceErrorToJson(err: unknown): ErrorJsonResult {
  if (err instanceof AuthError) return authErrorToJson(err);
  if (err instanceof CategoryError || err instanceof ProductError) {
    return {
      status: err.httpStatus,
      body: { ok: false, code: err.code, message: err.message },
    };
  }
  return {
    status: 500,
    body: { ok: false, code: "INTERNAL", message: "internal error" },
  };
}

export function badJsonBody(): ErrorJsonResult {
  return {
    status: 400,
    body: { ok: false, code: "BAD_BODY", message: "request body must be JSON" },
  };
}
