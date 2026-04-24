import { IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MetaAdsSelectAccountDto {
  @ApiProperty({ description: 'Campaign ID to attach the ad account to.' })
  @IsUUID()
  campaignId: string;

  // Meta ad account ID — must match one returned by listAdAccounts() for this user.
  // Accepted with or without the "act_" prefix — normalized internally.
  @ApiProperty({ description: 'Meta ad account ID (e.g. "act_123456789" or "123456789").' })
  @IsString()
  adAccountId: string;
}
