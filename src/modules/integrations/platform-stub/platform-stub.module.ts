import { Module } from '@nestjs/common';
import { PlatformStubController } from './platform-stub.controller';
import { StandardOAuthService } from './standard-oauth.service';
import { StandardApiKeyService } from './standard-api-key.service';
import { StandardTokenService } from './standard-token.service';
import { IntegrationsModule } from '../integrations.module';
import { OAuthStateModule } from '../oauth-state/oauth-state.module';

@Module({
  imports: [
    IntegrationsModule, // exports IntegrationsService (storeTokens, getDecryptedTokens)
    OAuthStateModule,   // exports OAuthStateService (sign/verify state JWT)
    // TenantModule and DatabaseModule are @Global — no import needed
  ],
  controllers: [PlatformStubController],
  providers: [StandardOAuthService, StandardApiKeyService, StandardTokenService],
  exports: [StandardTokenService, StandardApiKeyService],
})
export class PlatformStubModule {}
