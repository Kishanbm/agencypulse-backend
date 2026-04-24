import {
  IsString,
  IsEnum,
  IsArray,
  IsOptional,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IntegrationPlatform } from '@prisma/client';
import { WidgetConfigDto, WidgetPositionDto } from './create-widget.dto';

export class UpdateWidgetDto {
  @ApiPropertyOptional({ enum: IntegrationPlatform })
  @IsEnum(IntegrationPlatform)
  @IsOptional()
  platform?: IntegrationPlatform;

  @ApiPropertyOptional({ type: [String], description: 'At least one metric key required if provided' })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1, { message: 'At least one metric key is required' })
  @IsOptional()
  metricKeys?: string[];

  @ApiPropertyOptional({ type: WidgetConfigDto })
  @ValidateNested()
  @Type(() => WidgetConfigDto)
  @IsOptional()
  config?: WidgetConfigDto;

  @ApiPropertyOptional({ type: WidgetPositionDto })
  @ValidateNested()
  @Type(() => WidgetPositionDto)
  @IsOptional()
  position?: WidgetPositionDto;
}
