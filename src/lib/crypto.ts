/**
 * Crypto utilities for passphrase hashing using Web Crypto API
 * Uses PBKDF2-SHA256 with 100,000 iterations for secure password hashing
 */

const ITERATIONS = 100000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Generate a cryptographically secure random salt
 */
function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

/**
 * Convert ArrayBuffer to hex string
 */
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hex string to Uint8Array
 */
function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Derive key from passphrase using PBKDF2
 */
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  return crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: salt,
      iterations: ITERATIONS,
    },
    keyMaterial,
    KEY_LENGTH * 8
  );
}

/**
 * Hash a passphrase using PBKDF2-SHA256
 * Returns format: salt$hash (both hex encoded)
 */
export async function hashPassphrase(passphrase: string): Promise<string> {
  const salt = generateSalt();
  const derivedKey = await deriveKey(passphrase, salt);
  // Use slice to get exact buffer for the Uint8Array view (prevents memory exposure)
  const saltBuffer = salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength);
  const saltHex = bufferToHex(saltBuffer);
  const hashHex = bufferToHex(derivedKey);
  return `${saltHex}$${hashHex}`;
}

/**
 * Verify a passphrase against a stored hash
 * Uses constant-time comparison to prevent timing attacks
 */
export async function verifyPassphrase(
  passphrase: string,
  storedHash: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const [saltHex, expectedHashHex] = storedHash.split('$');
    if (!saltHex || !expectedHashHex) {
      return { success: false, error: 'Invalid stored hash format' };
    }

    const salt = hexToBuffer(saltHex);
    const derivedKey = await deriveKey(passphrase, salt);
    const actualHashHex = bufferToHex(derivedKey);

    // Constant-time comparison - always compare full length
    // Pad shorter string to prevent length leak
    const maxLen = Math.max(actualHashHex.length, expectedHashHex.length);
    let result = actualHashHex.length !== expectedHashHex.length ? 1 : 0;

    for (let i = 0; i < maxLen; i++) {
      const a = actualHashHex.charCodeAt(i) || 0;
      const b = expectedHashHex.charCodeAt(i) || 0;
      result |= a ^ b;
    }
    return { success: result === 0 };
  } catch (error) {
    console.error('[AntiSlack] Passphrase verification error:', error);
    return { success: false, error: 'System error during verification' };
  }
}

/**
 * Validate passphrase strength
 */
export function validatePassphrase(passphrase: string): { valid: boolean; error?: string } {
  if (!passphrase || passphrase.length < 8) {
    return { valid: false, error: 'Passphrase must be at least 8 characters' };
  }
  if (passphrase.length > 128) {
    return { valid: false, error: 'Passphrase must be 128 characters or less' };
  }
  return { valid: true };
}
