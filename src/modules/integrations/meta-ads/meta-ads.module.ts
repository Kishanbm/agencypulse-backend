import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../integrations.module';
import { OAuthStateModule } from '../oauth-state/oauth-state.module';
import { MetaAdsController } from './meta-ads.controller';
import { MetaAdsOAuthService } from './meta-ads-oauth.service';
import { MetaAdsApiService } from './meta-ads-api.service';

@Module({
  imports: [
    IntegrationsModule, // exports IntegrationsService (storeTokens, getDecryptedTokens)
    OAuthStateModule,   // exports OAuthStateService (sign/verify state JWT)
    // Note: No GoogleModule — Meta uses OAuthStateService directly, not GoogleOAuthService.
    // This is the correct decoupling. Fix (AI review): do NOT reuse GoogleOAuthService for Meta.
  ],
  controllers: [MetaAdsController],
  providers: [MetaAdsOAuthService, MetaAdsApiService],
  // Exported so Phase 3.5 BullMQ workers can inject them for data fetching
  exports: [MetaAdsOAuthService, MetaAdsApiService],
})
export class MetaAdsModule {}
