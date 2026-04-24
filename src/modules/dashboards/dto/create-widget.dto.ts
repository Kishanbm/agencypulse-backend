import {
  IsString,
  IsEnum,
  IsArray,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
  IsNumber,
  IsIn,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WidgetType, IntegrationPlatform } from '@prisma/client';

// ─── Nested DTOs ─────────────────────────────────────────────────────────────

export class WidgetFiltersDto {
  @ApiPropertyOptional({ example: 'mobile' })
  @IsString()
  @IsOptional()
  device?: string;

  @ApiPropertyOptional({ example: 'US' })
  @IsString()
  @IsOptional()
  country?: string;
}

export class WidgetConfigDto {
  @ApiProperty({ example: 'Sessions' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ enum: ['sum', 'avg', 'last'], default: 'sum' })
  @IsIn(['sum', 'avg', 'last'])
  @IsOptional()
  aggregation?: 'sum' | 'avg' | 'last';

  @ApiPropertyOptional({ enum: ['previous_period', 'previous_year', 'none'], default: 'none' })
  @IsIn(['previous_period', 'previous_year', 'none'])
  @IsOptional()
  comparison?: 'previous_period' | 'previous_year' | 'none';

  @ApiPropertyOptional()
  @ValidateNested()
  @Type(() => WidgetFiltersDto)
  @IsOptional()
  filters?: WidgetFiltersDto;
}

export class WidgetPositionDto {
  @ApiProperty({ example: 0 })
  @IsNumber()
  x: number;

  @ApiProperty({ example: 0 })
  @IsNumber()
  y: number;

  @ApiProperty({ example: 3 })
  @IsNumber()
  w: number;

  @ApiProperty({ example: 2 })
  @IsNumber()
  h: number;
}

// ─── Main DTO ─────────────────────────────────────────────────────────────────

export class CreateWidgetDto {
  @ApiProperty({ enum: WidgetType })
  @IsEnum(WidgetType)
  widgetType: WidgetType;

  @ApiPropertyOptional({ enum: IntegrationPlatform })
  @IsEnum(IntegrationPlatform)
  @IsOptional()
  platform?: IntegrationPlatform;

  @ApiProperty({ type: [String], example: ['sessions', 'users'], description: 'At least one metric key required' })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1, { message: 'At least one metric key is required' })
  metricKeys: string[];

  @ApiProperty({ type: WidgetConfigDto })
  @ValidateNested()
  @Type(() => WidgetConfigDto)
  config: WidgetConfigDto;

  @ApiProperty({ type: WidgetPositionDto })
  @ValidateNested()
  @Type(() => WidgetPositionDto)
  position: WidgetPositionDto;
}
