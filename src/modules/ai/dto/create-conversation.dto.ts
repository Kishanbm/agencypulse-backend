import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateConversationDto {
  @ApiProperty({ example: 'Why did sessions drop last week?', maxLength: 2000 })
  @IsString() @IsNotEmpty() @MaxLength(2000)
  question: string;
}
