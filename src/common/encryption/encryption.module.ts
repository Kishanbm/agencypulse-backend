import { Global, Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';

// @Global() — EncryptionService is used by IntegrationsService and any future
// module that handles OAuth tokens. Making it global avoids re-importing
// EncryptionModule in every feature module.
@Global()
@Module({
  providers: [EncryptionService],
  exports: [EncryptionService],
})
export class EncryptionModule {}
