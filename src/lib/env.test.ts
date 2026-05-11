import { describe, it, expect } from "vitest";
import { validateEnv, EnvValidationError, ENV_SPEC } from "./env";

/**
 * Tests for runtime env validation (MAS-19 logic, covered by MAS-20).
 *
 * `validateEnv` is pure — we drive it with synthetic `process.env`-shaped
 * objects rather than mutating the live environment.
 */

function baseDev(): NodeJS.ProcessEnv {
  // Minimum required-in-every-env vars satisfied.
  return {
    NODE_ENV: "development",
    APP_URL: "http://localhost:3000",
    DATABASE_URL: "postgresql://u:p@localhost:5432/db",
    REDIS_URL: "redis://localhost:6379",
    NEXTAUTH_SECRET: "dev-secret",
    NEXTAUTH_URL: "http://localhost:3000",
    JWT_SECRET: "dev-jwt",
  };
}

describe("validateEnv", () => {
  it("accepts a complete dev env", () => {
    const out = validateEnv(baseDev());
    expect(out.APP_URL).toBe("http://localhost:3000");
    expect(out.NODE_ENV).toBe("development");
  });

  it("freezes its output", () => {
    const out = validateEnv(baseDev());
    expect(Object.isFrozen(out)).toBe(true);
  });

  it("throws EnvValidationError listing every missing required var", () => {
    const env = baseDev();
    delete env.DATABASE_URL;
    delete env.JWT_SECRET;

    expect(() => validateEnv(env)).toThrowError(EnvValidationError);

    try {
      validateEnv(env);
    } catch (e) {
      const err = e as EnvValidationError;
      expect(err.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining("DATABASE_URL"),
          expect.stringContaining("JWT_SECRET"),
        ]),
      );
    }
  });

  it("treats empty strings as missing", () => {
    const env = baseDev();
    env.NEXTAUTH_SECRET = "   ";
    expect(() => validateEnv(env)).toThrowError(/NEXTAUTH_SECRET/);
  });

  it("requires production-only vars when NODE_ENV=production", () => {
    const env = baseDev();
    env.NODE_ENV = "production";
    // Missing all prod-only vars (MIDTRANS, OTP, etc.)
    expect(() => validateEnv(env)).toThrowError(EnvValidationError);
  });

  it("does NOT require production-only vars in dev", () => {
    const env = baseDev();
    // No MIDTRANS_SERVER_KEY etc., but NODE_ENV=development.
    expect(() => validateEnv(env)).not.toThrow();
  });

  it("rejects malformed URLs", () => {
    const env = baseDev();
    env.APP_URL = "not a url";
    expect(() => validateEnv(env)).toThrowError(/APP_URL/);
  });

  it("rejects non-boolean MIDTRANS_IS_PRODUCTION", () => {
    const env = baseDev();
    env.MIDTRANS_IS_PRODUCTION = "yes";
    expect(() => validateEnv(env)).toThrowError(/MIDTRANS_IS_PRODUCTION/);
  });

  it("accepts MIDTRANS_IS_PRODUCTION = 'true' or 'false'", () => {
    const ok = baseDev();
    ok.MIDTRANS_IS_PRODUCTION = "false";
    expect(() => validateEnv(ok)).not.toThrow();

    ok.MIDTRANS_IS_PRODUCTION = "true";
    expect(() => validateEnv(ok)).not.toThrow();
  });

  it("exposes ENV_SPEC for documentation/introspection", () => {
    expect(ENV_SPEC.required).toContain("DATABASE_URL");
    expect(ENV_SPEC.urls).toContain("APP_URL");
    expect(ENV_SPEC.booleans).toContain("MIDTRANS_IS_PRODUCTION");
  });
});
