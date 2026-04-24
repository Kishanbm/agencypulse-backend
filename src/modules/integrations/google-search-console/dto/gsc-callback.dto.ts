import { IsString } from 'class-validator';

export class GscCallbackDto {
  @IsString()
  code!: string;

  @IsString()
  state!: string;
}
