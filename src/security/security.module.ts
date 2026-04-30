import { Module } from '@nestjs/common';
import { AbacGuard } from './guards/abac.guard';
import { AuditLogInterceptor } from './interceptors/audit-log.interceptor';
import { EncryptionService } from './utils/crypto';
import { PiiMasker } from './utils/pii-masker';

@Module({
  providers: [AbacGuard, AuditLogInterceptor, EncryptionService, PiiMasker],
  exports: [AbacGuard, AuditLogInterceptor, EncryptionService, PiiMasker],
})
export class SecurityModule {}
