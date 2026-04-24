import { IsString, IsNotEmpty, IsEnum, IsArray, IsOptional, MaxLength, IsIn, ArrayMaxSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type SectionType = 'METRICS' | 'CHART' | 'TEXT';

export class ReportSectionDto {
  @ApiProperty({ description: 'Unique section identifier within the report' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ enum: ['METRICS', 'CHART', 'TEXT'] })
  @IsIn(['METRICS', 'CHART', 'TEXT'])
  type: SectionType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ description: 'Platform for data sections (GA4, GOOGLE_ADS, etc.)' })
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiPropertyOptional({ description: 'Metric keys to display in this section (max 10)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10, { message: 'A section can have at most 10 metric keys' })
  metricKeys?: string[];

  @ApiPropertyOptional({ description: 'Chart type for CHART sections' })
  @IsOptional()
  @IsIn(['LINE_CHART', 'BAR_CHART', 'PIE_CHART'])
  chartType?: string;

  @ApiPropertyOptional({ description: 'Free text content for TEXT sections' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;

  @ApiPropertyOptional({ description: 'Display order (0-based)' })
  @IsOptional()
  order: number;
}
