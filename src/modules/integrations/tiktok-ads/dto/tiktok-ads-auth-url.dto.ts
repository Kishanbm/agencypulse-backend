import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TiktokAdsAuthUrlDto {
  @ApiProperty()
  @IsUUID()
  campaignId!: string;
}
