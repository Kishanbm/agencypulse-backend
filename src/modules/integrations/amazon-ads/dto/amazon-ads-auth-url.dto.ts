import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AmazonAdsAuthUrlDto {
  @ApiProperty()
  @IsUUID()
  campaignId!: string;
}
