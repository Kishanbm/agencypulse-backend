import { IsString, IsOptional, MaxLength, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SaveAsTemplateDto {
  @ApiProperty({ example: 'My Top Client Monthly Dashboard' })
  @IsString() @IsNotEmpty() @MaxLength(255)
  templateName: string;

  @ApiPropertyOptional({ example: 'The dashboard layout we use for all our ecommerce clients' })
  @IsOptional()
  @IsString()
  templateDescription?: string;
}
