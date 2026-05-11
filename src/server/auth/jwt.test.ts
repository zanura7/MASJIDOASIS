/**
 * JWT unit tests — MAS-22.
 *
 * Covers: roundtrip, expiry, signature tampering, alg rejection,
 * issuer/audience enforcement, config validation.
 */

import { describe, expect, it } from "vitest";

import { JwtError, signJwt, verifyJwt } from "./jwt";

const SECRET = "test-secret-must-be-long-enough-32";

describe("signJwt + verifyJwt", () => {
  it("roundtrips a payload", () => {
    const token = signJwt(
      { sub: "user_1", phone: "628111" },
      { secret: SECRET, expiresInSec: 60 },
    );
    const payload = verifyJwt(token, { secret: SECRET });
    expect(payload.sub).toBe("user_1");
    expect(payload.phone).toBe("628111");
    expect(payload.iss).toBe("masjidoasis");
    expect(typeof payload.iat).toBe("number");
    expect(typeof payload.exp).toBe("number");
  });

  it("rejects a token signed with a different secret", () => {
    const token = signJwt(
      { sub: "user_2" },
      { secret: SECRET, expiresInSec: 60 },
    );
    expect(() => verifyJwt(token, { secret: SECRET + "x" })).toThrowError(JwtError);
  });

  it("rejects a tampered payload", () => {
    const token = signJwt(
      { sub: "user_3" },
      { secret: SECRET, expiresInSec: 60 },
    );
    const parts = token.split(".");
    const tampered = `${parts[0]}.${Buffer.from('{"sub":"attacker"}').toString("base64url")}.${parts[2]}`;
    expect(() => verifyJwt(tampered, { secret: SECRET })).toThrow(/signature/);
  });

  it("rejects an expired token", () => {
    const token = signJwt({ sub: "u" }, { secret: SECRET, expiresInSec: 60 });
    // Pretend now() is 10 minutes ahead.
    const farFuture = Math.floor(Date.now() / 1000) + 600;
    expect(() => verifyJwt(token, { secret: SECRET, now: farFuture })).toThrow(/expired/);
  });

  it("rejects unsupported alg", () => {
    // Hand-craft an unsigned token with alg:none.
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" }))
      .toString("base64url");
    const payload = Buffer.from(JSON.stringify({ sub: "x", exp: 9_999_999_999 }))
      .toString("base64url");
    const token = `${header}.${payload}.`;
    expect(() => verifyJwt(token, { secret: SECRET })).toThrow(/alg/);
  });

  it("enforces issuer match when requested", () => {
    const token = signJwt({ sub: "u" }, { secret: SECRET, expiresInSec: 60, issuer: "other" });
    expect(() => verifyJwt(token, { secret: SECRET, issuer: "masjidoasis" })).toThrow(/iss/);
  });

  it("enforces audience match when requested", () => {
    const token = signJwt(
      { sub: "u" },
      { secret: SECRET, expiresInSec: 60, audience: "web" },
    );
    const ok = verifyJwt(token, { secret: SECRET, audience: "web" });
    expect(ok.aud).toBe("web");
    expect(() => verifyJwt(token, { secret: SECRET, audience: "mobile" })).toThrow(/aud/);
  });

  it("rejects malformed tokens", () => {
    expect(() => verifyJwt("", { secret: SECRET })).toThrow(/empty/);
    expect(() => verifyJwt("one.two", { secret: SECRET })).toThrow(/segments/);
    expect(() => verifyJwt("not-base64.x.y", { secret: SECRET })).toThrow();
  });

  it("requires a long-enough secret to sign", () => {
    expect(() =>
      signJwt({ sub: "u" }, { secret: "short", expiresInSec: 60 }),
    ).toThrow(/secret/);
  });

  it("requires positive expiresInSec", () => {
    expect(() =>
      signJwt({ sub: "u" }, { secret: SECRET, expiresInSec: 0 }),
    ).toThrow(/expires/);
  });
});
