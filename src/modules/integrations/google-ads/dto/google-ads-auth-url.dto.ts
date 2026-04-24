import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GoogleAdsAuthUrlDto {
  @ApiProperty({ description: 'Campaign ID to connect Google Ads to.' })
  @IsUUID()
  campaignId: string;
}
