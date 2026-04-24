import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResendInviteDto {
  @ApiProperty({ example: 'jane@myagency.com' })
  @IsEmail()
  email: string;
}
