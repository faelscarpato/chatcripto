/**
 * Derives a cryptographic key from a password and salt using PBKDF2.
 */
export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    } as Pbkdf2Params,
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Helper to convert ArrayBuffer or Uint8Array to Base64 without blowing the stack.
 */
function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Helper to convert Base64 to Uint8Array.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes as Uint8Array;
}

/**
 * Helper to convert Base64 to Blob.
 */
export function base64ToBlob(base64: string, contentType: string = 'application/octet-stream'): Blob {
  const bytes = base64ToUint8Array(base64);
  return new Blob([bytes as any], { type: contentType });
}

/**
 * Encrypts a message (string or ArrayBuffer) using AES-GCM.
 */
export async function encryptData(data: string | ArrayBuffer, key: CryptoKey): Promise<{ encrypted: string; iv: string }> {
  const encoder = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const buffer = typeof data === 'string' ? encoder.encode(data) : data;
  
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as any,
    },
    key,
    buffer
  );

  return {
    encrypted: bufferToBase64(encryptedBuffer),
    iv: bufferToBase64(iv),
  };
}

/**
 * Decrypts data into an ArrayBuffer using AES-GCM.
 */
export async function decryptToBuffer(encrypted: string, iv: string, key: CryptoKey): Promise<ArrayBuffer> {
  const encryptedBuffer = base64ToUint8Array(encrypted);
  const ivBuffer = base64ToUint8Array(iv);

  return window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivBuffer as any,
    },
    key,
    encryptedBuffer as any
  );
}

/**
 * Encrypts a message using AES-GCM.
 */
export async function encryptMessage(message: string, key: CryptoKey): Promise<{ encrypted: string; iv: string }> {
  return encryptData(message, key);
}

/**
 * Decrypts a message using AES-GCM.
 */
export async function decryptMessage(encrypted: string, iv: string, key: CryptoKey): Promise<string> {
  const decoder = new TextDecoder();
  try {
    const decryptedBuffer = await decryptToBuffer(encrypted, iv, key);
    return decoder.decode(decryptedBuffer);
  } catch (e) {
    console.error('Decryption failed:', e);
    return '[Encrypted Message - Wrong Key]';
  }
}

/**
 * Generate a salt for key derivation. 
 */
export function getSalt(roomId: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(roomId.padEnd(16, '0').slice(0, 16));
}
