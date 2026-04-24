import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({ example: 'What about the week before?', maxLength: 2000 })
  @IsString() @IsNotEmpty() @MaxLength(2000)
  content: string;
}
