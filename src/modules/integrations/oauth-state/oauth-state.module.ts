import { Module } from '@nestjs/common';
import { OAuthStateService } from './oauth-state.service';

/**
 * Shared module for platform-agnostic OAuth state JWT utilities.
 * Imported by GoogleModule, MetaAdsModule, and all future integration modules.
 */
@Module({
  providers: [OAuthStateService],
  exports: [OAuthStateService],
})
export class OAuthStateModule {}
