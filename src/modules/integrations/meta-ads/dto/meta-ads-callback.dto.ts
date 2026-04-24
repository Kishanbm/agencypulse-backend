import { IsString } from 'class-validator';

export class MetaAdsCallbackDto {
  @IsString()
  code: string;

  @IsString()
  state: string;
}
