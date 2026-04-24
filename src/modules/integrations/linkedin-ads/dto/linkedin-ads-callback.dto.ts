import { IsString } from 'class-validator';

export class LinkedinAdsCallbackDto {
  @IsString()
  code!: string;

  @IsString()
  state!: string;
}
