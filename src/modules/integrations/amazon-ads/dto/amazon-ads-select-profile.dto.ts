import { IsUUID, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AmazonAdsSelectProfileDto {
  @ApiProperty()
  @IsUUID()
  campaignId!: string;

  @ApiProperty({ description: 'Amazon Advertising profile ID (numeric string)' })
  @IsString()
  profileId!: string;
}
