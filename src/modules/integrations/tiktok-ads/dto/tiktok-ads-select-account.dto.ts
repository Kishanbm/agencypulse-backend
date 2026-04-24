import { IsUUID, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TiktokAdsSelectAccountDto {
  @ApiProperty()
  @IsUUID()
  campaignId!: string;

  @ApiProperty({ description: 'TikTok Advertiser ID (numeric string)' })
  @IsString()
  advertiserId!: string;
}
