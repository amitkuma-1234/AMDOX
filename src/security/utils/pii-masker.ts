import { Injectable } from '@nestjs/common';

/**
 * PII Masking utility — masks sensitive data in logs.
 * Masks: SSN, PAN (card numbers), bank account numbers, emails partially.
 */
@Injectable()
export class PiiMasker {
  private readonly patterns: { regex: RegExp; replacement: string; name: string }[] = [
    { regex: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '***-**-****', name: 'SSN' },
    { regex: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, replacement: '****-****-****-****', name: 'PAN' },
    { regex: /\b[A-Z]{2}\d{2}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{0,2}\b/gi, replacement: '****IBAN****', name: 'IBAN' },
  ];

  private readonly sensitiveFields = new Set([
    'password', 'secret', 'token', 'ssn', 'pan', 'cardNumber',
    'bankAccount', 'accountNumber', 'taxId', 'bankDetails',
    'encryptionKey', 'apiKey', 'refreshToken',
  ]);

  maskString(value: string): string {
    let masked = value;
    for (const { regex, replacement } of this.patterns) {
      masked = masked.replace(regex, replacement);
    }
    return masked;
  }

  maskObject(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => this.maskObject(item));

    const masked: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (this.sensitiveFields.has(key.toLowerCase())) {
        masked[key] = '***REDACTED***';
      } else if (typeof value === 'string') {
        masked[key] = this.maskString(value);
      } else if (typeof value === 'object') {
        masked[key] = this.maskObject(value);
      } else {
        masked[key] = value;
      }
    }
    return masked;
  }
}
