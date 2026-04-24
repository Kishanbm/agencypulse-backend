import { IsString } from 'class-validator';

export class Ga4CallbackDto {
  @IsString()
  code: string;

  // Signed state JWT — contains campaignId, tenantId, userId, platform
  @IsString()
  state: string;
}
