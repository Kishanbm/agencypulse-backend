import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResendClientInviteDto {
  @ApiProperty({ example: 'client@example.com' })
  @IsEmail()
  email: string;
}
