// Encrypts/decrypts per-application Cloudflare API tokens before they touch D1.
// The master key (base64, 32 raw bytes) lives only in Secrets Store — see wrangler.jsonc.

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

async function importMasterKey(masterKeyBase64: string): Promise<CryptoKey> {
  const raw = fromBase64(masterKeyBase64);
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptToken(
  masterKeyBase64: string,
  plaintext: string
): Promise<{ ciphertext: string; iv: string }> {
  const key = await importMasterKey(masterKeyBase64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return {
    ciphertext: toBase64(new Uint8Array(encrypted)),
    iv: toBase64(iv),
  };
}

export async function decryptToken(
  masterKeyBase64: string,
  ciphertext: string,
  iv: string
): Promise<string> {
  const key = await importMasterKey(masterKeyBase64);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(iv) },
    key,
    fromBase64(ciphertext)
  );
  return new TextDecoder().decode(decrypted);
}
