/**
 * Auth middleware helpers — MAS-23.
 *
 * Provides:
 *   - `extractBearerToken(req)`     — read the `Authorization: Bearer <jwt>` header
 *   - `requireAuth(req, opts)`      — verify the JWT and return its claims
 *   - `requireRole(req, roles, opts)` — `requireAuth` + assert `role` claim ∈ roles
 *
 * These are pure helpers — they THROW `AuthError` on failure rather than
 * sending a response, so route handlers stay in control of the response
 * shape. A thin convenience `withAuth` wraps a route handler and converts
 * the thrown error into a JSON 401/403.
 *
 * Why we mint our own JWT (not NextAuth session): the public REST API
 * needs a stateless bearer token usable from non-browser clients (mobile,
 * Postman, server-to-server). NextAuth's encrypted cookie is fine for the
 * web admin but not for that surface. Both can coexist — NextAuth handles
 * web login state; this middleware handles bearer-token APIs.
 *
 * The `role` claim is the **point-in-time** role at token issue. For
 * sensitive operations the handler should re-fetch the User from the DB
 * (a deactivated admin's token still verifies until it expires).
 */

import { JwtError, verifyJwt, type JwtPayload } from "./jwt";

/** Roles known to the application. Mirrors the Prisma `Role` enum. */
export const ROLES = ["MEMBER", "SELLER", "USTADZ", "DOKTER", "ADMIN"] as const;
export type AppRole = (typeof ROLES)[number];

export function isAppRole(v: unknown): v is AppRole {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v);
}

export interface AuthClaims extends JwtPayload {
  sub: string;
  role: AppRole;
  /** Optional convenience fields propagated from the token. */
  phone?: string;
}

export class AuthError extends Error {
  readonly code:
    | "MISSING_TOKEN"
    | "MALFORMED_TOKEN"
    | "INVALID_TOKEN"
    | "EXPIRED"
    | "FORBIDDEN_ROLE"
    | "MISSING_ROLE"
    | "CONFIG";
  readonly httpStatus: number;
  constructor(
    code: AuthError["code"],
    httpStatus: number,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

/**
 * Minimal request shape we depend on — keeps these helpers usable from
 * Next.js route handlers (NextRequest), edge handlers (Request), and
 * tests (a plain object with `.headers.get`).
 */
export interface AuthRequestLike {
  headers: {
    get(name: string): string | null;
  };
}

/**
 * Pull `Authorization: Bearer <jwt>` out of a request. Returns the raw
 * token string or `null` if absent/malformed. Tolerates the `Bearer`
 * keyword in any case ("bearer", "BEARER", "Bearer").
 */
export function extractBearerToken(req: AuthRequestLike): string | null {
  const h = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!h) return null;
  const m = /^Bearer\s+([^\s]+)$/i.exec(h.trim());
  return m ? (m[1] ?? null) : null;
}

export interface RequireAuthOptions {
  /** JWT signing secret. Defaults to `process.env.JWT_SECRET`. */
  secret?: string;
  /** Issuer the token must match. Default: "masjidoasis". */
  issuer?: string;
  /** Audience the token must match. Default: "masjidoasis-web". */
  audience?: string;
}

function resolveSecret(opts: RequireAuthOptions | undefined): string {
  const s = opts?.secret ?? process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    throw new AuthError(
      "CONFIG",
      500,
      "JWT_SECRET missing or shorter than 16 characters",
    );
  }
  return s;
}

/**
 * Verify a request's bearer token. Returns the decoded claims (with the
 * `role` claim narrowed to `AppRole`). Throws `AuthError` on any
 * problem — missing header, bad format, bad signature, expired, etc.
 *
 * Defaults:
 *   - issuer  = "masjidoasis"
 *   - audience = "masjidoasis-web"
 *
 * Both can be overridden per-route — e.g. a mobile API route might
 * require `audience: "masjidoasis-mobile"`.
 */
export function requireAuth(
  req: AuthRequestLike,
  opts?: RequireAuthOptions,
): AuthClaims {
  const token = extractBearerToken(req);
  if (!token) {
    throw new AuthError("MISSING_TOKEN", 401, "Authorization Bearer token required");
  }
  const secret = resolveSecret(opts);
  let payload: JwtPayload;
  try {
    payload = verifyJwt(token, {
      secret,
      issuer: opts?.issuer ?? "masjidoasis",
      audience: opts?.audience ?? "masjidoasis-web",
    });
  } catch (err) {
    if (err instanceof JwtError) {
      if (err.code === "expired") {
        throw new AuthError("EXPIRED", 401, "token has expired");
      }
      if (err.code === "malformed") {
        throw new AuthError("MALFORMED_TOKEN", 401, err.message);
      }
      throw new AuthError("INVALID_TOKEN", 401, err.message);
    }
    throw err;
  }
  if (typeof payload.sub !== "string" || payload.sub === "") {
    throw new AuthError("MALFORMED_TOKEN", 401, "token missing `sub` claim");
  }
  if (!isAppRole(payload.role)) {
    throw new AuthError("MISSING_ROLE", 401, "token missing/invalid `role` claim");
  }
  return payload as AuthClaims;
}

/**
 * Like `requireAuth` but also asserts the token's `role` claim is in the
 * allowed list. Throws `AuthError(FORBIDDEN_ROLE)` with HTTP 403 if not.
 *
 * Pass roles as a tuple, e.g. `requireRole(req, ["ADMIN"])` or
 * `requireRole(req, ["ADMIN", "USTADZ"])`.
 */
export function requireRole(
  req: AuthRequestLike,
  allowed: readonly AppRole[],
  opts?: RequireAuthOptions,
): AuthClaims {
  if (allowed.length === 0) {
    throw new AuthError("CONFIG", 500, "requireRole called with empty allowed list");
  }
  const claims = requireAuth(req, opts);
  if (!allowed.includes(claims.role)) {
    throw new AuthError(
      "FORBIDDEN_ROLE",
      403,
      `role ${claims.role} not in [${allowed.join(", ")}]`,
    );
  }
  return claims;
}

/**
 * Serialise an `AuthError` (or any error) to the JSON shape used by the
 * auth API. Caller chooses the response object — keeps this pure.
 */
export function authErrorToJson(err: unknown): {
  status: number;
  body: { ok: false; code: string; message: string };
} {
  if (err instanceof AuthError) {
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
