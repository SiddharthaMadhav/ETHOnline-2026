import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

/** Hashes a publisher secret for storage. Never store publisher secrets in plaintext. */
export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = (await scrypt(secret, salt, KEY_LENGTH)) as Buffer;
  return `scrypt:${salt.toString("hex")}:${derivedKey.toString("hex")}`;
}

export async function verifySecret(secret: string, storedHash: string): Promise<boolean> {
  const [scheme, saltHex, keyHex] = storedHash.split(":");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;

  const salt = Buffer.from(saltHex, "hex");
  const expectedKey = Buffer.from(keyHex, "hex");
  const derivedKey = (await scrypt(secret, salt, expectedKey.length)) as Buffer;

  return timingSafeEqual(derivedKey, expectedKey);
}
