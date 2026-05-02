import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { IntegrationPlatform } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AgencyMetricsSummaryDto {
  @ApiProperty({ description: 'Start date (YYYY-MM-DD)' })
  @IsDateString()
  from: string;

  @ApiProperty({ description: 'End date (YYYY-MM-DD)' })
  @IsDateString()
  to: string;

  @ApiPropertyOptional({ enum: IntegrationPlatform })
  @IsOptional()
  @IsEnum(IntegrationPlatform)
  platform?: IntegrationPlatform;

  @ApiPropertyOptional({ description: 'Comma-separated metric keys. Omit for all.' })
  @IsOptional()
  @IsString()
  metrics?: string;
}

export enum RankingOrder {
  ASC  = 'asc',
  DESC = 'desc',
}

export class CampaignRankingDto {
  @ApiProperty({ description: 'Metric key to rank by (e.g. sessions, clicks, impressions)' })
  @IsString()
  metric: string;

  @ApiPropertyOptional({ description: 'Start date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'End date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ enum: IntegrationPlatform })
  @IsOptional()
  @IsEnum(IntegrationPlatform)
  platform?: IntegrationPlatform;

  @ApiPropertyOptional({ description: 'Max results (1–50, default 10)' })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;

  @ApiPropertyOptional({ enum: RankingOrder, default: RankingOrder.DESC })
  @IsOptional()
  @IsEnum(RankingOrder)
  order?: RankingOrder = RankingOrder.DESC;
}

export interface MetricWithDelta {
  value: number;
  prior: number | null;
  delta: number | null; // percentage change, null when prior is 0 or no data
}

export interface AgencyMetricsSummaryResult {
  metrics: Record<string, MetricWithDelta>;
  period: { from: string; to: string };
  priorPeriod: { from: string; to: string };
}

export interface CampaignRankingItem {
  campaignId: string;
  campaignName: string;
  clientId: string;
  clientName: string;
  value: number;
  priorValue: number | null;
  delta: number | null;
}
