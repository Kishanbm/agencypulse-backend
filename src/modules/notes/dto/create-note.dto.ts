import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateNoteDto {
  @ApiProperty({ example: 'Meta Ads CTR dropped 12% this week — investigating ad fatigue.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body: string;
}
