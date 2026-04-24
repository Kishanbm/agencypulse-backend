import { IsString, IsNotEmpty, IsArray, IsOptional, MaxLength, ValidateNested, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportSectionDto } from './section.dto';

export class CreateReportDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    description: 'Report sections (max 20)',
    type: [ReportSectionDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMaxSize(20, { message: 'A report can have at most 20 sections' })
  @Type(() => ReportSectionDto)
  sections?: ReportSectionDto[];
}
