import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MetaAdsAuthUrlDto {
  @ApiProperty({ description: 'Campaign ID to connect Meta Ads to.' })
  @IsUUID()
  campaignId: string;
}
