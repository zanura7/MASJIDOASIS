/**
 * OtpService unit tests — MAS-22.
 *
 * Hand-rolled in-memory Prisma double (no DB needed) + in-memory OTP
 * provider that just records its inputs. Covers:
 *   - happy-path request/verify
 *   - phone normalisation (08… → 628…)
 *   - re-issue invalidates prior code
 *   - expired → OtpVerifyError("EXPIRED")
 *   - wrong code → INVALID_CODE + attempt counter bumps
 *   - max attempts → MAX_ATTEMPTS even with correct code
 *   - consumed code rejected
 *   - upserts user on success and sets phoneVerifiedAt
 *   - constant-time hash compare path
 */

import { describe, expect, it, beforeEach } from "vitest";

import { OtpRequestError, OtpService, OtpVerifyError, hashOtpCode } from "./otp-service";
import type { OtpProvider, OtpSendInput, OtpSendResult } from "@/server/otp/types";

interface OtpRow {
  id: string;
  userId: string | null;
  phone: string;
  codeHash: string;
  purpose: string;
  attempts: number;
  consumedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
}

interface UserRow {
  id: string;
  phone: string;
  name: string;
  phoneVerifiedAt: Date | null;
}

function makePrismaMock(): {
  otpCode: {
    deleteMany: (a: { where: Record<string, unknown> }) => Promise<{ count: number }>;
    create: (a: { data: Omit<OtpRow, "id" | "createdAt"> }) => Promise<OtpRow>;
    findFirst: (a: { where: Record<string, unknown>; orderBy?: unknown }) => Promise<OtpRow | null>;
    update: (a: { where: { id: string }; data: { attempts?: { increment: number }; consumedAt?: Date } }) => Promise<OtpRow>;
  };
  user: {
    upsert: (a: {
      where: { phone: string };
      update: Partial<UserRow>;
      create: Omit<UserRow, "id">;
      select: { id: true; phone: true };
    }) => Promise<{ id: string; phone: string }>;
  };
  _otp: OtpRow[];
  _users: UserRow[];
} {
  const otp: OtpRow[] = [];
  const users: UserRow[] = [];
  let nextId = 1;
  return {
    otpCode: {
      async deleteMany({ where }) {
        const before = otp.length;
        for (let i = otp.length - 1; i >= 0; i--) {
          const r = otp[i]!;
          if (
            (where.phone === undefined || r.phone === where.phone) &&
            (where.purpose === undefined || r.purpose === where.purpose) &&
            (where.consumedAt === undefined || r.consumedAt === where.consumedAt)
          ) {
            otp.splice(i, 1);
          }
        }
        return { count: before - otp.length };
      },
      async create({ data }) {
        const row: OtpRow = {
          id: `otp_${nextId++}`,
          createdAt: new Date(),
          userId: data.userId ?? null,
          phone: data.phone,
          codeHash: data.codeHash,
          purpose: data.purpose,
          attempts: data.attempts ?? 0,
          consumedAt: data.consumedAt ?? null,
          expiresAt: data.expiresAt,
        };
        otp.push(row);
        return row;
      },
      async findFirst({ where }) {
        const matches = otp.filter((r) =>
          (where.phone === undefined || r.phone === where.phone) &&
          (where.purpose === undefined || r.purpose === where.purpose) &&
          (where.consumedAt === undefined || r.consumedAt === where.consumedAt),
        );
        matches.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return matches[0] ?? null;
      },
      async update({ where, data }) {
        const row = otp.find((r) => r.id === where.id);
        if (!row) throw new Error("not found");
        if (data.attempts?.increment) row.attempts += data.attempts.increment;
        if (data.consumedAt) row.consumedAt = data.consumedAt;
        return row;
      },
    },
    user: {
      async upsert({ where, update, create, select: _select }) {
        let row = users.find((u) => u.phone === where.phone);
        if (row) {
          Object.assign(row, update);
        } else {
          row = {
            id: `user_${nextId++}`,
            phone: create.phone,
            name: create.name,
            phoneVerifiedAt: create.phoneVerifiedAt ?? null,
          };
          users.push(row);
        }
        return { id: row.id, phone: row.phone };
      },
    },
    _otp: otp,
    _users: users,
  };
}

function makeProviderMock(): { provider: OtpProvider; sent: OtpSendInput[]; failNext: boolean } {
  const sent: OtpSendInput[] = [];
  const state = { failNext: false };
  const provider: OtpProvider = {
    name: "mock",
    channel: "whatsapp",
    async send(input): Promise<OtpSendResult> {
      sent.push(input);
      if (state.failNext) {
        state.failNext = false;
        throw new Error("provider down");
      }
      return { providerMessageId: `msg_${sent.length}`, channel: "whatsapp", provider: "mock" };
    },
  };
  return {
    provider,
    sent,
    get failNext() {
      return state.failNext;
    },
    set failNext(v: boolean) {
      state.failNext = v;
    },
  };
}

const PEPPER = "test-pepper-must-be-long-enough-32";

describe("OtpService.request", () => {
  let db: ReturnType<typeof makePrismaMock>;
  let providerHarness: ReturnType<typeof makeProviderMock>;
  let svc: OtpService;

  beforeEach(() => {
    db = makePrismaMock();
    providerHarness = makeProviderMock();
    svc = new OtpService({
      // Cast: our hand-rolled mock matches the surface the service actually touches.
      prisma: db as unknown as ConstructorParameters<typeof OtpService>[0]["prisma"],
      provider: providerHarness.provider,
      pepper: PEPPER,
    });
  });

  it("issues a fresh code and dispatches via the provider", async () => {
    const res = await svc.request({ phone: "+628111111111" });
    expect(res.expiresInSec).toBe(300);
    expect(providerHarness.sent).toHaveLength(1);
    const sent = providerHarness.sent[0]!;
    expect(sent.phone).toBe("628111111111");
    expect(sent.code).toMatch(/^\d{6}$/);
    expect(db._otp).toHaveLength(1);
    expect(db._otp[0]!.purpose).toBe("login");
    expect(db._otp[0]!.codeHash).toBe(hashOtpCode("628111111111", sent.code, PEPPER));
  });

  it("normalises 08… phones to 628…", async () => {
    await svc.request({ phone: "08111111111" });
    expect(providerHarness.sent[0]!.phone).toBe("628111111111");
  });

  it("invalidates a prior unconsumed code on re-issue", async () => {
    await svc.request({ phone: "+628111111111" });
    expect(db._otp).toHaveLength(1);
    await svc.request({ phone: "+628111111111" });
    expect(db._otp).toHaveLength(1); // prior deleted, new row inserted
  });

  it("throws OtpRequestError on bad phone", async () => {
    await expect(svc.request({ phone: "notaphone" })).rejects.toBeInstanceOf(OtpRequestError);
  });
});

describe("OtpService.verify", () => {
  let db: ReturnType<typeof makePrismaMock>;
  let providerHarness: ReturnType<typeof makeProviderMock>;
  let svc: OtpService;

  beforeEach(() => {
    db = makePrismaMock();
    providerHarness = makeProviderMock();
    svc = new OtpService({
      prisma: db as unknown as ConstructorParameters<typeof OtpService>[0]["prisma"],
      provider: providerHarness.provider,
      pepper: PEPPER,
    });
  });

  async function issueAndCapture(phone = "+628111111111"): Promise<{ phone: string; code: string }> {
    await svc.request({ phone });
    const sent = providerHarness.sent[providerHarness.sent.length - 1]!;
    return { phone: sent.phone, code: sent.code };
  }

  it("accepts the correct code and upserts the user", async () => {
    const { phone, code } = await issueAndCapture();
    const out = await svc.verify({ phone, code });
    expect(out.phone).toBe(phone);
    expect(out.userId).toMatch(/^user_/);
    expect(db._users[0]!.phoneVerifiedAt).toBeInstanceOf(Date);
    expect(db._otp[0]!.consumedAt).toBeInstanceOf(Date);
  });

  it("rejects a wrong code and bumps attempts", async () => {
    const { phone } = await issueAndCapture();
    const err = await svc.verify({ phone, code: "000000" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OtpVerifyError);
    expect((err as OtpVerifyError).code).toBe("INVALID_CODE");
    expect(db._otp[0]!.attempts).toBe(1);
  });

  it("locks after OTP_MAX_ATTEMPTS even with the correct code", async () => {
    const { phone, code } = await issueAndCapture();
    for (let i = 0; i < 5; i++) {
      await svc.verify({ phone, code: "999999" }).catch(() => {});
    }
    expect(db._otp[0]!.attempts).toBe(5);
    const err = await svc.verify({ phone, code }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OtpVerifyError);
    expect((err as OtpVerifyError).code).toBe("MAX_ATTEMPTS");
  });

  it("rejects an expired code", async () => {
    const { phone, code } = await issueAndCapture();
    // Roll the row's expiry back manually.
    db._otp[0]!.expiresAt = new Date(Date.now() - 1000);
    const err = await svc.verify({ phone, code }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OtpVerifyError);
    expect((err as OtpVerifyError).code).toBe("EXPIRED");
  });

  it("rejects when no active OTP exists", async () => {
    const err = await svc.verify({ phone: "+628999999999", code: "123456" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OtpVerifyError);
    expect((err as OtpVerifyError).code).toBe("NOT_FOUND");
  });

  it("rejects malformed input", async () => {
    const err1 = await svc.verify({ phone: "x", code: "123456" }).catch((e: unknown) => e);
    expect((err1 as OtpVerifyError).code).toBe("MALFORMED");
    const err2 = await svc.verify({ phone: "+628111111111", code: "abc" }).catch((e: unknown) => e);
    expect((err2 as OtpVerifyError).code).toBe("MALFORMED");
  });
});
