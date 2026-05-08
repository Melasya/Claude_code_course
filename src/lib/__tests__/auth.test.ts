import { describe, test, expect } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

import { hashPassword, verifyPassword } from "@/lib/auth";
import { vi } from "vitest";

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
