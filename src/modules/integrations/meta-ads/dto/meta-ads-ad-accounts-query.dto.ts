import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MetaAdsAdAccountsQueryDto {
  @ApiProperty({ description: 'Campaign ID for the connected Meta Ads integration.' })
  @IsUUID()
  campaignId: string;
}
