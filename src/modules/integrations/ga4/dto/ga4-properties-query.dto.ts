import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class Ga4PropertiesQueryDto {
  @ApiProperty({ description: 'Campaign ID for the connected GA4 integration.' })
  @IsUUID()
  campaignId: string;
}
