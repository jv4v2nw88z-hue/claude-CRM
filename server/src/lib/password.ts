/**
 * Password hashing on WebCrypto.
 *
 * bcrypt is a native/pure-JS CPU grinder that Workers cannot run within its CPU
 * budget, so this uses PBKDF2-HMAC-SHA256 through SubtleCrypto — implemented in
 * native code inside the runtime, which is both faster and available on the edge.
 *
 * Stored format:  pbkdf2$<iterations>$<salt-b64>$<hash-b64>
 * Keeping the iteration count inside the string means it can be raised later
 * without invalidating existing hashes.
 */

/**
 * 100k iterations costs roughly 25–30 ms of CPU per login. That is comfortably
 * inside the Workers **Paid** plan's 30 s budget but over the **Free** plan's
 * 10 ms per-invocation limit, so logins need the $5/month plan. Nothing else in
 * the app comes close to the limit — this is the only deliberately slow path.
 *
 * Lowering this trades password strength for the free tier; raising it (OWASP
 * suggests more) costs only login latency. Existing hashes keep working either
 * way, because the count they were made with is stored alongside them.
 */
const ITERATIONS = 100_000;
const KEY_BITS = 256;
const SALT_BYTES = 16;
const SCHEME = "pbkdf2";

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    KEY_BITS
  );
  return new Uint8Array(bits);
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Constant-time comparison so a wrong password can't be narrowed down by timing. */
function equals(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, ITERATIONS);
  return `${SCHEME}$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== SCHEME) return false;

  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;

  try {
    const salt = fromBase64(parts[2]);
    const expected = fromBase64(parts[3]);
    const actual = await derive(password, salt, iterations);
    return equals(actual, expected);
  } catch {
    return false;
  }
}
