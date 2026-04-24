import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../integrations.module';
import { GoogleModule } from '../google/google.module';
import { GoogleAdsController } from './google-ads.controller';
import { GoogleAdsOAuthService } from './google-ads-oauth.service';
import { GoogleAdsApiService } from './google-ads-api.service';

@Module({
  imports: [
    IntegrationsModule, // exports IntegrationsService (storeTokens, getDecryptedTokens)
    GoogleModule,       // exports GoogleOAuthService (shared sign/verify/exchange/refresh)
  ],
  controllers: [GoogleAdsController],
  providers: [GoogleAdsOAuthService, GoogleAdsApiService],
  // Exported so Phase 3.5 BullMQ workers can inject them directly
  exports: [GoogleAdsOAuthService, GoogleAdsApiService],
})
export class GoogleAdsModule {}
