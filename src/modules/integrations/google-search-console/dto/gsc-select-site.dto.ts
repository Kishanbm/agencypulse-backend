import { IsUUID, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GscSelectSiteDto {
  @ApiProperty()
  @IsUUID()
  campaignId!: string;

  @ApiProperty({ description: 'GSC site URL, e.g. "sc-domain:example.com" or "https://example.com/"' })
  @IsString()
  siteUrl!: string;
}
