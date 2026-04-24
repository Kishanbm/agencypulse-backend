import { IsDateString, IsEnum, IsString, IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IntegrationPlatform } from '@prisma/client';
import { Type } from 'class-transformer';

export class ForecastQueryDto {
  @ApiProperty({ enum: IntegrationPlatform })
  @IsEnum(IntegrationPlatform)
  platform: IntegrationPlatform;

  @ApiProperty({ example: 'sessions' })
  @IsString()
  metricKey: string;

  @ApiProperty({ example: '2026-04-01', description: 'Historical window start' })
  @IsDateString()
  from: string;

  @ApiProperty({ example: '2026-04-30', description: 'Historical window end' })
  @IsDateString()
  to: string;

  @ApiProperty({ example: 30, description: 'Days to forecast ahead (1–90)', default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  forecastDays?: number;
}
