import { IsString } from 'class-validator';

export class AmazonAdsCallbackDto {
  @IsString()
  code!: string;

  @IsString()
  state!: string;
}
