import { IsUUID, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class YoutubeSelectChannelDto {
  @ApiProperty()
  @IsUUID()
  campaignId!: string;

  @ApiProperty({ description: 'YouTube channel ID (e.g. "UCxxxxxx")' })
  @IsString()
  channelId!: string;
}
