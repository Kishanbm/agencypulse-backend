import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../integrations.module';
import { OAuthStateModule } from '../oauth-state/oauth-state.module';
import { TiktokAdsController } from './tiktok-ads.controller';
import { TiktokAdsOAuthService } from './tiktok-ads-oauth.service';
import { TiktokAdsApiService } from './tiktok-ads-api.service';

@Module({
  imports: [
    IntegrationsModule,
    OAuthStateModule,
  ],
  controllers: [TiktokAdsController],
  providers: [TiktokAdsOAuthService, TiktokAdsApiService],
  exports: [TiktokAdsOAuthService, TiktokAdsApiService],
})
export class TiktokAdsModule {}
