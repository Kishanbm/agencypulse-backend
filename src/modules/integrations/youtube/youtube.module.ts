import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../integrations.module';
import { OAuthStateModule } from '../oauth-state/oauth-state.module';
import { GoogleModule } from '../google/google.module';
import { YoutubeController } from './youtube.controller';
import { YoutubeOAuthService } from './youtube-oauth.service';
import { YoutubeApiService } from './youtube-api.service';

@Module({
  imports: [
    IntegrationsModule,
    OAuthStateModule,
    GoogleModule,
  ],
  controllers: [YoutubeController],
  providers: [YoutubeOAuthService, YoutubeApiService],
  exports: [YoutubeOAuthService, YoutubeApiService],
})
export class YoutubeModule {}
