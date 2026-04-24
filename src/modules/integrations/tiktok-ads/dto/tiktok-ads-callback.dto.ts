import { IsString } from 'class-validator';

// TikTok uses "auth_code" (not "code") as the callback query parameter.
// This is intentional — TikTok for Business API v1.3 spec.
export class TiktokAdsCallbackDto {
  @IsString()
  auth_code!: string;

  @IsString()
  state!: string;
}
