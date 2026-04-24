import { IsUUID, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LinkedinAdsSelectAccountDto {
  @ApiProperty()
  @IsUUID()
  campaignId!: string;

  @ApiProperty({ description: 'LinkedIn Ad Account numeric ID (e.g. "123456789")' })
  @IsString()
  accountId!: string;
}
