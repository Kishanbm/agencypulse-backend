import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../integrations.module';
import { OAuthStateModule } from '../oauth-state/oauth-state.module';
import { GoogleModule } from '../google/google.module';
import { GscController } from './gsc.controller';
import { GscOAuthService } from './gsc-oauth.service';
import { GscApiService } from './gsc-api.service';

@Module({
  imports: [
    IntegrationsModule,  // storeTokens, getDecryptedTokens
    OAuthStateModule,    // OAuthStateService (sign/verify state JWT)
    GoogleModule,        // GoogleOAuthService (exchangeCode, refreshAccessToken)
  ],
  controllers: [GscController],
  providers: [GscOAuthService, GscApiService],
  exports: [GscOAuthService, GscApiService],
})
export class GscModule {}
