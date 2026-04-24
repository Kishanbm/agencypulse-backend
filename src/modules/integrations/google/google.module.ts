import { Module } from '@nestjs/common';
import { OAuthStateModule } from '../oauth-state/oauth-state.module';
import { GoogleOAuthService } from './google-oauth.service';

/**
 * Shared module for all Google platform integrations.
 * GoogleOAuthService handles code exchange + token refresh (Google endpoints).
 * State JWT sign/verify is delegated to OAuthStateService (from OAuthStateModule)
 * so Meta and future non-Google platforms are not coupled to GoogleOAuthService.
 */
@Module({
  imports: [OAuthStateModule],
  providers: [GoogleOAuthService],
  exports: [GoogleOAuthService],
})
export class GoogleModule {}
