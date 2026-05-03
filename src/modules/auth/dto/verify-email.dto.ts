import { IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
  @ApiProperty({ description: 'Verification token from the email link' })
  @IsString()
  @MaxLength(128)
  token: string;
}
