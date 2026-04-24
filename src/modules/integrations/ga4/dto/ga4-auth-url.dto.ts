import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class Ga4AuthUrlDto {
  // Fix 3: Only campaignId accepted — clientId is derived from the DB, never trusted from input
  @ApiProperty({ description: 'Campaign ID to connect GA4 to.' })
  @IsUUID()
  campaignId: string;
}
