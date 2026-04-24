import {
  IsDateString, IsEnum, IsOptional, IsString, IsArray,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IntegrationPlatform } from '@prisma/client';
import { Transform } from 'class-transformer';
import { MetricGranularity } from '../../metrics/dto/query-metrics.dto';

export enum ExportFormat {
  CSV = 'csv',
  XLSX = 'xlsx',
}

export class ExportQueryDto {
  @ApiProperty({ enum: IntegrationPlatform })
  @IsEnum(IntegrationPlatform)
  platform: IntegrationPlatform;

  @ApiProperty({ example: '2026-04-01' })
  @IsDateString()
  from: string;

  @ApiProperty({ example: '2026-04-30' })
  @IsDateString()
  to: string;

  @ApiProperty({ enum: ExportFormat, default: ExportFormat.CSV })
  @IsOptional()
  @IsEnum(ExportFormat)
  format?: ExportFormat;

  @ApiProperty({ enum: MetricGranularity, default: MetricGranularity.DAY })
  @IsOptional()
  @IsEnum(MetricGranularity)
  granularity?: MetricGranularity;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  metricKeys?: string[];
}
