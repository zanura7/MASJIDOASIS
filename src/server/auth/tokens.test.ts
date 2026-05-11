/**
 * TokenService unit tests — MAS-23.
 *
 * In-memory `SessionStore` double — no Prisma needed. Covers:
 *   - issueTokenPair persists a Session row hash, not the raw token
 *   - rotateRefreshToken: happy path
 *   - rotateRefreshToken: unknown token → INVALID_REFRESH
 *   - rotateRefreshToken: expired → EXPIRED_REFRESH
 *   - rotateRefreshToken: reuse after rotation → REUSE_DETECTED + all sessions killed
 *   - rotateRefreshToken: deactivated user → REVOKED
 *   - revokeRefreshToken: idempotent on unknown/already-revoked tokens
 */

import { describe, it, expect, beforeEach } from "vitest";

import {
  TokenError,
  TokenService,
  hashRefreshToken,
  REFRESH_TOKEN_TTL_SEC,
  type SessionStore,
} from "./tokens";
import type { AppRole } from "./middleware";
import { verifyJwt } from "./jwt";

const SECRET = "test-secret-must-be-at-least-32-chars-long";

interface SessionRow {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

interface UserRow {
  id: string;
  phone: string;
  role: AppRole;
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
}

function makeStore(initialUsers: UserRow[] = [
  { id: "user_1", phone: "628111", role: "MEMBER", status: "ACTIVE" },
]): { store: SessionStore; sessions: SessionRow[]; users: UserRow[] } {
  const sessions: SessionRow[] = [];
  const users = [...initialUsers];
  let nextId = 1;
  const store: SessionStore = {
    session: {
      async create({ data }) {
        const row: SessionRow = {
          id: `sess_${nextId++}`,
          userId: data.userId,
          token: data.token,
          expiresAt: data.expiresAt,
          revokedAt: null,
        };
        sessions.push(row);
        return row;
      },
      async findUnique({ where }) {
        return sessions.find((s) => s.token === where.token) ?? null;
      },
      async update({ where, data }) {
        const row = sessions.find((s) => s.id === where.id);
        if (!row) throw new Error("session not found");
        if (data.revokedAt !== undefined) row.revokedAt = data.revokedAt;
        return { id: row.id };
      },
      async updateMany({ where, data }) {
        let count = 0;
        for (const s of sessions) {
          if (s.userId === where.userId && s.revokedAt === null) {
            s.revokedAt = data.revokedAt;
            count++;
          }
        }
        return { count };
      },
    },
    user: {
      async findUnique({ where }) {
        const u = users.find((x) => x.id === where.id);
        return u ? { id: u.id, phone: u.phone, role: u.role, status: u.status } : null;
      },
    },
  };
  return { store, sessions, users };
}

describe("TokenService.issueTokenPair", () => {
  it("mints an access JWT with role + a refresh token, persists hashed Session", async () => {
    const { store, sessions } = makeStore();
    const svc = new TokenService({ db: store, jwtSecret: SECRET });
    const pair = await svc.issueTokenPair({
      userId: "user_1",
      phone: "628111",
      role: "MEMBER",
      userAgent: "vitest",
      ip: "127.0.0.1",
    });
    expect(pair.accessToken.split(".")).toHaveLength(3);
    expect(pair.refreshToken).toMatch(/^[a-f0-9]{64}$/);
    expect(pair.expiresIn).toBe(15 * 60);
    expect(pair.refreshExpiresIn).toBe(REFRESH_TOKEN_TTL_SEC);

    const claims = verifyJwt(pair.accessToken, {
      secret: SECRET,
      issuer: "masjidoasis",
      audience: "masjidoasis-web",
    });
    expect(claims.sub).toBe("user_1");
    expect(claims.role).toBe("MEMBER");
    expect(claims.phone).toBe("628111");

    expect(sessions).toHaveLength(1);
    // Stored token is the hash, NOT the raw value.
    expect(sessions[0]!.token).toBe(hashRefreshToken(pair.refreshToken));
    expect(sessions[0]!.token).not.toBe(pair.refreshToken);
  });
});

describe("TokenService.rotateRefreshToken", () => {
  let store: SessionStore;
  let sessions: SessionRow[];
  let svc: TokenService;

  beforeEach(() => {
    const made = makeStore();
    store = made.store;
    sessions = made.sessions;
    svc = new TokenService({ db: store, jwtSecret: SECRET });
  });

  it("rotates a valid refresh token and revokes the old Session", async () => {
    const first = await svc.issueTokenPair({
      userId: "user_1",
      phone: "628111",
      role: "MEMBER",
    });
    const second = await svc.rotateRefreshToken(first.refreshToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(sessions).toHaveLength(2);
    expect(sessions[0]!.revokedAt).toBeInstanceOf(Date);
    expect(sessions[1]!.revokedAt).toBeNull();
  });

  it("throws INVALID_REFRESH for an unknown token", async () => {
    const err = await svc
      .rotateRefreshToken("deadbeef".repeat(8))
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TokenError);
    expect((err as TokenError).code).toBe("INVALID_REFRESH");
    expect((err as TokenError).httpStatus).toBe(401);
  });

  it("throws INVALID_REFRESH for empty token", async () => {
    const err = await svc.rotateRefreshToken("").catch((e: unknown) => e);
    expect((err as TokenError).code).toBe("INVALID_REFRESH");
  });

  it("throws EXPIRED_REFRESH when the Session has expired", async () => {
    const first = await svc.issueTokenPair({
      userId: "user_1",
      phone: "628111",
      role: "MEMBER",
    });
    // Roll session expiry back manually.
    sessions[0]!.expiresAt = new Date(Date.now() - 1000);
    const err = await svc
      .rotateRefreshToken(first.refreshToken)
      .catch((e: unknown) => e);
    expect((err as TokenError).code).toBe("EXPIRED_REFRESH");
  });

  it("detects re-use of a rotated token and revokes ALL the user's sessions", async () => {
    const first = await svc.issueTokenPair({
      userId: "user_1",
      phone: "628111",
      role: "MEMBER",
    });
    // Open a second concurrent device for the same user.
    const concurrent = await svc.issueTokenPair({
      userId: "user_1",
      phone: "628111",
      role: "MEMBER",
    });
    // Rotate the first token legitimately.
    const second = await svc.rotateRefreshToken(first.refreshToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);

    // Attacker replays the (already-rotated) first token.
    const err = await svc
      .rotateRefreshToken(first.refreshToken)
      .catch((e: unknown) => e);
    expect((err as TokenError).code).toBe("REUSE_DETECTED");

    // Both still-active sessions (the legit rotation result + the
    // concurrent device) should now be revoked.
    const active = sessions.filter((s) => s.revokedAt === null);
    expect(active).toHaveLength(0);

    // And the second device's refresh token must now also fail.
    const err2 = await svc
      .rotateRefreshToken(concurrent.refreshToken)
      .catch((e: unknown) => e);
    expect((err2 as TokenError).code).toBe("REUSE_DETECTED");
  });

  it("throws REVOKED when the user is no longer ACTIVE", async () => {
    const made = makeStore([
      { id: "user_2", phone: "628222", role: "MEMBER", status: "SUSPENDED" },
    ]);
    const svc2 = new TokenService({ db: made.store, jwtSecret: SECRET });
    // We can still mint a pair (issuance doesn't validate status), but
    // rotation should reject it.
    const first = await svc2.issueTokenPair({
      userId: "user_2",
      phone: "628222",
      role: "MEMBER",
    });
    const err = await svc2
      .rotateRefreshToken(first.refreshToken)
      .catch((e: unknown) => e);
    expect((err as TokenError).code).toBe("REVOKED");
  });
});

describe("TokenService.revokeRefreshToken", () => {
  it("revokes an active session and is idempotent on re-revoke", async () => {
    const { store, sessions } = makeStore();
    const svc = new TokenService({ db: store, jwtSecret: SECRET });
    const first = await svc.issueTokenPair({
      userId: "user_1",
      phone: "628111",
      role: "MEMBER",
    });
    const r1 = await svc.revokeRefreshToken(first.refreshToken);
    expect(r1.revoked).toBe(true);
    expect(sessions[0]!.revokedAt).toBeInstanceOf(Date);
    const r2 = await svc.revokeRefreshToken(first.refreshToken);
    expect(r2.revoked).toBe(false);
  });

  it("returns revoked:false for unknown / empty input", async () => {
    const { store } = makeStore();
    const svc = new TokenService({ db: store, jwtSecret: SECRET });
    expect((await svc.revokeRefreshToken("")).revoked).toBe(false);
    expect((await svc.revokeRefreshToken("deadbeef".repeat(8))).revoked).toBe(false);
  });
});

describe("TokenService construction", () => {
  it("throws CONFIG on missing/short jwtSecret", () => {
    const { store } = makeStore();
    expect(() => new TokenService({ db: store, jwtSecret: "short" })).toThrowError(
      TokenError,
    );
  });
});
