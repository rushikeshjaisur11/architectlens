import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const N = 2 ** 15;
const R = 8;
const P = 1;
const KEYLEN = 64;
export const MIN_PASSWORD = 10;
export const MAX_PASSWORD = 128;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function derive(password: string, salt: Buffer, n: number, r: number, p: number, keylen: number) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, keylen, { N: n, r, p, maxmem: 128 * n * r * 2 }, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export const normaliseEmail = (email: string) => email.trim().toLowerCase();

export const isValidEmail = (email: string) => email.length <= 254 && EMAIL_RE.test(email);

export const passwordProblem = (password: string) =>
  password.length < MIN_PASSWORD
    ? `Password must be at least ${MIN_PASSWORD} characters`
    : password.length > MAX_PASSWORD
      ? `Password must be at most ${MAX_PASSWORD} characters`
      : null;

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P, KEYLEN);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !hash) return false;
  const [nn, rr, pp] = [n, r, p].map(Number);
  if (![nn, rr, pp].every((v) => Number.isInteger(v) && v > 0) || nn > 2 ** 20 || rr > 32 || pp > 16) return false;
  const expected = Buffer.from(hash, "base64");
  if (expected.length === 0) return false;
  const key = await derive(password, Buffer.from(salt, "base64"), nn, rr, pp, expected.length).catch(() => null);
  return key !== null && timingSafeEqual(key, expected);
}

let dummy: Promise<string> | undefined;
export const verifyDummy = async (password: string) => {
  await verifyPassword(password, await (dummy ??= hashPassword("dummy-password")));
  return null;
};
