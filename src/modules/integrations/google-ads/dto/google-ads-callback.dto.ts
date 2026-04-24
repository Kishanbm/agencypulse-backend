import { IsString } from 'class-validator';

export class GoogleAdsCallbackDto {
  @IsString()
  code: string;

  @IsString()
  state: string;
}
