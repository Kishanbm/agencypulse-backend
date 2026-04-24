import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../integrations.module';
import { GoogleModule } from '../google/google.module';
import { Ga4Controller } from './ga4.controller';
import { Ga4OAuthService } from './ga4-oauth.service';
import { Ga4ApiService } from './ga4-api.service';

@Module({
  imports: [
    IntegrationsModule,  // exports IntegrationsService (storeTokens, getDecryptedTokens)
    GoogleModule,        // exports GoogleOAuthService (shared sign/verify/exchange/refresh)
  ],
  controllers: [Ga4Controller],
  providers: [Ga4OAuthService, Ga4ApiService],
  // Export Ga4OAuthService + Ga4ApiService so Phase 3.5 BullMQ workers
  // can inject them directly to fetch metrics and refresh tokens.
  exports: [Ga4OAuthService, Ga4ApiService],
})
export class Ga4Module {}
