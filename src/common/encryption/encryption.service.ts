import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;  // 96-bit IV — standard for GCM
const TAG_BYTES = 16; // 128-bit auth tag

@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor(private readonly config: ConfigService) {
    const hexKey = this.config.get<string>('encryption.key') ?? '';
    // Key is validated at startup by validateEnv — safe to Buffer.from here.
    // Never log this key.
    this.key = Buffer.from(hexKey, 'hex');
  }

  /**
   * Encrypts plaintext using AES-256-GCM.
   * Returns: v1:<iv_hex>:<tag_hex>:<ciphertext_hex>
   *
   * Format is versioned (v1:) so future key rotation or algorithm changes
   * can be handled by detecting the version prefix without touching all rows.
   */
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return `v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  /**
   * Decrypts a token produced by encrypt().
   * Supports v1: format; extensible to v2: etc. without breaking existing tokens.
   */
  decrypt(encryptedToken: string): string {
    const parts = encryptedToken.split(':');

    if (parts.length !== 4) {
      throw new Error('[Encryption] Invalid encrypted token format.');
    }

    const [version, ivHex, tagHex, ciphertextHex] = parts;

    if (version !== 'v1') {
      throw new Error(`[Encryption] Unsupported token version: ${version}`);
    }

    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');
  }

  /**
   * Returns the byte length of the key (should always be 32 for AES-256).
   * Useful for startup diagnostics — safe to log (length only, not key value).
   */
  get keyLengthBytes(): number {
    return this.key.length;
  }
}
