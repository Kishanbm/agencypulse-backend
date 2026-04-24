import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../integrations.module';
import { OAuthStateModule } from '../oauth-state/oauth-state.module';
import { LinkedinAdsController } from './linkedin-ads.controller';
import { LinkedinAdsOAuthService } from './linkedin-ads-oauth.service';
import { LinkedinAdsApiService } from './linkedin-ads-api.service';

@Module({
  imports: [
    IntegrationsModule,
    OAuthStateModule,
  ],
  controllers: [LinkedinAdsController],
  providers: [LinkedinAdsOAuthService, LinkedinAdsApiService],
  exports: [LinkedinAdsOAuthService, LinkedinAdsApiService],
})
export class LinkedinAdsModule {}
