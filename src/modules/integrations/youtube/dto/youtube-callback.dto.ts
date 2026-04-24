import { IsString } from 'class-validator';

export class YoutubeCallbackDto {
  @IsString()
  code!: string;

  @IsString()
  state!: string;
}
