import { describe, expect, it } from "vitest";
import { hashPassword, isValidEmail, normaliseEmail, passwordProblem, verifyPassword } from "./password";

describe("password", () => {
  it("round-trips and rejects a wrong password", async () => {
    const h = await hashPassword("correct horse battery");
    expect(h).toMatch(/^scrypt\$32768\$8\$1\$[^$]+\$[^$]+$/);
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("wrong horse battery", h)).toBe(false);
  });

  it("uses a fresh salt each time", async () => {
    expect(await hashPassword("same-password-1")).not.toBe(await hashPassword("same-password-1"));
  });

  it("returns false for malformed stored hashes", async () => {
    for (const bad of ["", "plain", "scrypt$x$8$1$aa$bb", "bcrypt$1$1$1$aa$bb", "scrypt$32768$8$1$aa", "scrypt$99999999$8$1$aa$bb"]) {
      expect(await verifyPassword("whatever-123", bad)).toBe(false);
    }
  });

  it("normalises and validates email", () => {
    expect(normaliseEmail("  Foo@Example.COM ")).toBe("foo@example.com");
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("nope")).toBe(false);
  });

  it("enforces length rules", () => {
    expect(passwordProblem("short")).not.toBeNull();
    expect(passwordProblem("x".repeat(10))).toBeNull();
    expect(passwordProblem("x".repeat(129))).not.toBeNull();
  });
});
