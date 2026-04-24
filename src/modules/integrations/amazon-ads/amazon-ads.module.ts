import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../integrations.module';
import { OAuthStateModule } from '../oauth-state/oauth-state.module';
import { AmazonAdsController } from './amazon-ads.controller';
import { AmazonAdsOAuthService } from './amazon-ads-oauth.service';
import { AmazonAdsApiService } from './amazon-ads-api.service';

@Module({
  imports: [
    IntegrationsModule,
    OAuthStateModule,
  ],
  controllers: [AmazonAdsController],
  providers: [AmazonAdsOAuthService, AmazonAdsApiService],
  exports: [AmazonAdsOAuthService, AmazonAdsApiService],
})
export class AmazonAdsModule {}
