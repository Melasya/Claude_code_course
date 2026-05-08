import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

import { hashPassword, verifyPassword, createSession } from "@/lib/auth";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode("development-secret-key");

describe("createSession", () => {
  beforeEach(() => vi.clearAllMocks());

  test("sets a cookie named auth-token", async () => {
    await createSession("user-1", "test@example.com");

    expect(mockCookieStore.set).toHaveBeenCalledOnce();
    const [name] = mockCookieStore.set.mock.calls[0];
    expect(name).toBe("auth-token");
  });

  test("encodes userId and email in the JWT payload", async () => {
    await createSession("user-42", "user@example.com");

    const token: string = mockCookieStore.set.mock.calls[0][1];
    const { payload } = await jwtVerify(token, JWT_SECRET);
    expect(payload.userId).toBe("user-42");
    expect(payload.email).toBe("user@example.com");
  });

  test("sets httpOnly, sameSite lax, and path /", async () => {
    await createSession("user-1", "test@example.com");

    const options = mockCookieStore.set.mock.calls[0][2];
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });

  test("expires approximately 7 days from now", async () => {
    const before = Date.now();
    await createSession("user-1", "test@example.com");
    const after = Date.now();

    const options = mockCookieStore.set.mock.calls[0][2];
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(options.expires.getTime()).toBeGreaterThanOrEqual(before + sevenDays - 1000);
    expect(options.expires.getTime()).toBeLessThanOrEqual(after + sevenDays + 1000);
  });

  test("JWT itself expires in 7 days", async () => {
    const before = Math.floor(Date.now() / 1000);
    await createSession("user-1", "test@example.com");

    const token: string = mockCookieStore.set.mock.calls[0][1];
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const sevenDays = 7 * 24 * 60 * 60;
    expect(payload.exp).toBeGreaterThanOrEqual(before + sevenDays - 5);
    expect(payload.exp).toBeLessThanOrEqual(before + sevenDays + 5);
  });
});

describe("hashPassword", () => {
  test("returns a string that is not the original password", async () => {
    const hash = await hashPassword("secret123");
    expect(typeof hash).toBe("string");
    expect(hash).not.toBe("secret123");
  });

  test("produces a valid bcrypt hash (starts with $2b$)", async () => {
    const hash = await hashPassword("secret123");
    expect(hash).toMatch(/^\$2b\$/);
  });

  test("two hashes of the same password are different (unique salts)", async () => {
    const [a, b] = await Promise.all([
      hashPassword("secret123"),
      hashPassword("secret123"),
    ]);
    expect(a).not.toBe(b);
  });
});

describe("verifyPassword", () => {
  test("returns true for a correct password", async () => {
    const hash = await hashPassword("correct-horse");
    expect(await verifyPassword("correct-horse", hash)).toBe(true);
  });

  test("returns false for a wrong password", async () => {
    const hash = await hashPassword("correct-horse");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  test("returns false for an empty string against a real hash", async () => {
    const hash = await hashPassword("secret123");
    expect(await verifyPassword("", hash)).toBe(false);
  });

  test("is consistent with hashPassword round-trip", async () => {
    const passwords = ["short", "a longer passphrase!", "p@$$w0rd123"];
    for (const pw of passwords) {
      const hash = await hashPassword(pw);
      expect(await verifyPassword(pw, hash)).toBe(true);
      expect(await verifyPassword(pw + "x", hash)).toBe(false);
    }
  });
});
