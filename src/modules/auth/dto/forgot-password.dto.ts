import { IsEmail, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'jane@acmemarketing.com' })
  @IsEmail()
  @MaxLength(255)
  email: string;
}
