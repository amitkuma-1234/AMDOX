import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes, createHmac } from 'crypto';

/**
 * AES-256-GCM encryption utilities for sensitive fields.
 */
@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor() {
    const envKey = process.env.ENCRYPTION_KEY || 'amdox-default-key-change-in-prod!!';
    this.key = Buffer.from(envKey.padEnd(32, '0').slice(0, 32));
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${tag}:${encrypted}`;
  }

  decrypt(ciphertext: string): string {
    const [ivHex, tagHex, encrypted] = ciphertext.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  hmacSign(data: string, secret: string): string {
    return createHmac('sha256', secret).update(data).digest('hex');
  }

  hmacVerify(data: string, signature: string, secret: string): boolean {
    const expected = this.hmacSign(data, secret);
    return expected === signature;
  }
}
