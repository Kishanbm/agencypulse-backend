import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { IntegrationPlatform } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum MetricGranularity {
  DAY   = 'day',
  WEEK  = 'week',
  MONTH = 'month',
}

export enum MetricAggregate {
  SUM  = 'sum',
  AVG  = 'avg',
  LAST = 'last',
}

/** Query params for time-series chart data */
export class QueryMetricsDto {
  @ApiProperty()
  @IsUUID()
  campaignId: string;

  @ApiProperty({ enum: IntegrationPlatform })
  @IsEnum(IntegrationPlatform)
  platform: IntegrationPlatform;

  @ApiProperty({ description: 'Start date (YYYY-MM-DD)' })
  @IsDateString()
  from: string;

  @ApiProperty({ description: 'End date (YYYY-MM-DD)' })
  @IsDateString()
  to: string;

  @ApiPropertyOptional({ description: 'Comma-separated metric keys (e.g. sessions,totalUsers). Omit for all.' })
  @IsOptional()
  @IsString()
  metrics?: string;

  @ApiPropertyOptional({ enum: MetricGranularity, default: MetricGranularity.DAY })
  @IsOptional()
  @IsEnum(MetricGranularity)
  granularity?: MetricGranularity;

  @ApiPropertyOptional({ enum: MetricAggregate, default: MetricAggregate.SUM })
  @IsOptional()
  @IsEnum(MetricAggregate)
  aggregate?: MetricAggregate;
}

/** Query params for KPI summary (single aggregate value per metric — no granularity) */
export class QueryMetricSummaryDto {
  @ApiProperty()
  @IsUUID()
  campaignId: string;

  @ApiProperty({ enum: IntegrationPlatform })
  @IsEnum(IntegrationPlatform)
  platform: IntegrationPlatform;

  @ApiProperty({ description: 'Start date (YYYY-MM-DD)' })
  @IsDateString()
  from: string;

  @ApiProperty({ description: 'End date (YYYY-MM-DD)' })
  @IsDateString()
  to: string;

  @ApiPropertyOptional({ description: 'Comma-separated metric keys. Omit for all.' })
  @IsOptional()
  @IsString()
  metrics?: string;

  @ApiPropertyOptional({ enum: MetricAggregate, default: MetricAggregate.SUM })
  @IsOptional()
  @IsEnum(MetricAggregate)
  aggregate?: MetricAggregate;
}

/** Single metric row written by sync processors */
export interface MetricRowInput {
  metricKey: string;
  value: string;       // raw string from API — normalized before storage
  recordedAt: string;  // YYYY-MM-DD UTC
  dimensionKey?: string;
  dimensionVal?: string;
}

/** One period in a time-series response — metrics grouped by period */
export interface MetricPeriodRow {
  period: string;                  // YYYY-MM-DD (truncated period start, UTC)
  metrics: Record<string, number>; // { clicks: 120, impressions: 5000 }
}

/** Aggregate totals returned by GET /metrics/summary */
export interface MetricSummaryResult {
  metrics: Record<string, number>;
}
