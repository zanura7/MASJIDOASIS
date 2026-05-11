/**
 * Token issuance + refresh — MAS-23.
 *
 * Mints an access/refresh token pair from a verified user. Refresh tokens
 * are opaque (random 32-byte hex) and persisted into `Session` rows —
 * only the SHA-256 hash is stored, so a DB leak does not reveal valid
 * refresh tokens.
 *
 * Lifecycle:
 *   issueTokenPair(user)      → { accessToken (JWT 15 min), refreshToken (raw 30 d) }
 *   rotateRefreshToken(token) → revoke current Session, issue fresh pair
 *   revokeRefreshToken(token) → mark Session.revokedAt = now
 *
 * Rotation is one-shot — re-using a refresh token that was already
 * rotated returns `REUSE_DETECTED`. (Token-reuse on refresh is a
 * classic indicator of theft; the safe response is to revoke ALL
 * sessions for that user, which `rotateRefreshToken` does.)
 *
 * Why Session and not a separate RefreshToken table: MAS-16 already
 * provisioned `sessions(id, userId, token, userAgent, ip, expiresAt,
 * createdAt, revokedAt)` which fits the use case exactly. Adding a new
 * table would duplicate it.
 */

import { createHash, randomBytes } from "node:crypto";

import { signJwt } from "./jwt";
import type { AppRole } from "./middleware";

export const ACCESS_TOKEN_TTL_SEC = 15 * 60; // 15 minutes
export const REFRESH_TOKEN_TTL_SEC = 30 * 24 * 60 * 60; // 30 days

export class TokenError extends Error {
  readonly code:
    | "INVALID_REFRESH"
    | "EXPIRED_REFRESH"
    | "REVOKED"
    | "REUSE_DETECTED"
    | "CONFIG";
  readonly httpStatus: number;
  constructor(code: TokenError["code"], httpStatus: number, message: string) {
    super(message);
    this.name = "TokenError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

/** Minimal Prisma surface this module uses — kept narrow for testability. */
export interface SessionStore {
  session: {
    create(args: {
      data: {
        userId: string;
        token: string;
        userAgent?: string | null;
        ip?: string | null;
        expiresAt: Date;
      };
    }): Promise<{ id: string; userId: string; token: string; expiresAt: Date; revokedAt: Date | null }>;
    findUnique(args: {
      where: { token: string };
    }): Promise<{
      id: string;
      userId: string;
      token: string;
      expiresAt: Date;
      revokedAt: Date | null;
    } | null>;
    update(args: {
      where: { id: string };
      data: { revokedAt?: Date };
    }): Promise<{ id: string }>;
    updateMany(args: {
      where: { userId: string; revokedAt: null };
      data: { revokedAt: Date };
    }): Promise<{ count: number }>;
  };
  user: {
    findUnique(args: {
      where: { id: string };
      select: { id: true; phone: true; role: true; status: true };
    }): Promise<{ id: string; phone: string; role: AppRole; status: string } | null>;
  };
}

export interface IssueTokenPairInput {
  userId: string;
  phone: string;
  role: AppRole;
  /** Optional client metadata persisted on the Session row. */
  userAgent?: string | null;
  ip?: string | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

export interface TokenServiceDeps {
  db: SessionStore;
  /** JWT signing secret. */
  jwtSecret: string;
  /** Override the clock for tests. */
  now?: () => Date;
  /** Override the refresh-token generator for tests. Must return >=32 hex chars. */
  generateRefreshToken?: () => string;
}

/** Hash a refresh token for at-rest storage. */
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function defaultRefresh(): string {
  return randomBytes(32).toString("hex");
}

export class TokenService {
  private readonly db: SessionStore;
  private readonly jwtSecret: string;
  private readonly now: () => Date;
  private readonly genRefresh: () => string;

  constructor(deps: TokenServiceDeps) {
    if (!deps.jwtSecret || deps.jwtSecret.length < 16) {
      throw new TokenError("CONFIG", 500, "jwtSecret must be >= 16 characters");
    }
    this.db = deps.db;
    this.jwtSecret = deps.jwtSecret;
    this.now = deps.now ?? (() => new Date());
    this.genRefresh = deps.generateRefreshToken ?? defaultRefresh;
  }

  /**
   * Mint a fresh access+refresh pair and persist the refresh token (as a
   * hash) into a new Session row.
   */
  async issueTokenPair(input: IssueTokenPairInput): Promise<TokenPair> {
    const now = this.now();
    const accessToken = signJwt(
      { sub: input.userId, role: input.role, phone: input.phone },
      {
        secret: this.jwtSecret,
        expiresInSec: ACCESS_TOKEN_TTL_SEC,
        issuer: "masjidoasis",
        audience: "masjidoasis-web",
      },
    );
    const refreshToken = this.genRefresh();
    const expiresAt = new Date(now.getTime() + REFRESH_TOKEN_TTL_SEC * 1000);
    await this.db.session.create({
      data: {
        userId: input.userId,
        token: hashRefreshToken(refreshToken),
        userAgent: input.userAgent ?? null,
        ip: input.ip ?? null,
        expiresAt,
      },
    });
    return {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_TTL_SEC,
      refreshExpiresIn: REFRESH_TOKEN_TTL_SEC,
    };
  }

  /**
   * Rotate a refresh token: validate it, revoke the bound Session, mint
   * a new pair. Re-use of an already-revoked token revokes every active
   * session for the user (theft response).
   */
  async rotateRefreshToken(
    refreshToken: string,
    meta?: { userAgent?: string | null; ip?: string | null },
  ): Promise<TokenPair> {
    if (typeof refreshToken !== "string" || refreshToken.trim() === "") {
      throw new TokenError("INVALID_REFRESH", 401, "refresh token required");
    }
    const tokenHash = hashRefreshToken(refreshToken);
    const row = await this.db.session.findUnique({ where: { token: tokenHash } });
    if (!row) {
      throw new TokenError("INVALID_REFRESH", 401, "unknown refresh token");
    }
    const now = this.now();
    if (row.revokedAt !== null) {
      // Token-reuse after rotation → assume theft, kill all of this user's sessions.
      await this.db.session.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      throw new TokenError(
        "REUSE_DETECTED",
        401,
        "refresh token already used; all sessions revoked",
      );
    }
    if (row.expiresAt.getTime() <= now.getTime()) {
      throw new TokenError("EXPIRED_REFRESH", 401, "refresh token has expired");
    }
    const user = await this.db.user.findUnique({
      where: { id: row.userId },
      select: { id: true, phone: true, role: true, status: true },
    });
    if (!user || user.status !== "ACTIVE") {
      throw new TokenError("REVOKED", 401, "user is not active");
    }
    // Revoke first, then issue — so a race between two refreshes can't
    // hand out two simultaneously-valid descendants.
    await this.db.session.update({
      where: { id: row.id },
      data: { revokedAt: now },
    });
    return this.issueTokenPair({
      userId: user.id,
      phone: user.phone,
      role: user.role,
      userAgent: meta?.userAgent ?? null,
      ip: meta?.ip ?? null,
    });
  }

  /** Revoke a refresh token (logout). Idempotent — unknown token = no-op. */
  async revokeRefreshToken(refreshToken: string): Promise<{ revoked: boolean }> {
    if (typeof refreshToken !== "string" || refreshToken.trim() === "") {
      return { revoked: false };
    }
    const tokenHash = hashRefreshToken(refreshToken);
    const row = await this.db.session.findUnique({ where: { token: tokenHash } });
    if (!row || row.revokedAt !== null) {
      return { revoked: false };
    }
    await this.db.session.update({
      where: { id: row.id },
      data: { revokedAt: this.now() },
    });
    return { revoked: true };
  }
}
