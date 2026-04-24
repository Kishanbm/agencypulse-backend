import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GoogleAdsCustomersQueryDto {
  @ApiProperty({ description: 'Campaign ID for the connected Google Ads integration.' })
  @IsUUID()
  campaignId: string;
}
