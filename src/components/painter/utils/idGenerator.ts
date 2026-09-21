let fallbackSequence = 0;

export function generateUuid(): string {
  const webCrypto = globalThis.crypto;
  if (webCrypto && typeof webCrypto.randomUUID === 'function') {
    return webCrypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (webCrypto && typeof webCrypto.getRandomValues === 'function') {
    webCrypto.getRandomValues(bytes);
  } else {
    const now = Date.now();
    const sequence = fallbackSequence++;
    for (let index = 0; index < bytes.length; index++) {
      const timeByte = Math.floor(now / 2 ** ((index % 6) * 8)) % 256;
      const sequenceByte = Math.floor(sequence / 2 ** ((index % 4) * 8)) % 256;
      bytes[index] = Math.floor(Math.random() * 256) ^ timeByte ^ sequenceByte;
    }
  }

  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
