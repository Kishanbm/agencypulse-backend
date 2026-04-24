import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LinkedinAdsAuthUrlDto {
  @ApiProperty()
  @IsUUID()
  campaignId!: string;
}
