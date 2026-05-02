import { IsOptional, IsString } from 'class-validator';

export class YoutubeCallbackDto {
  @IsString()
  code!: string;

  @IsString()
  state!: string;

  @IsOptional() @IsString()
  scope?: string;

  @IsOptional() @IsString()
  authuser?: string;

  @IsOptional() @IsString()
  prompt?: string;

  @IsOptional() @IsString()
  iss?: string;
}
