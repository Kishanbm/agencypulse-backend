import { IsDateString, IsOptional, IsEnum, IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IntegrationPlatform } from '@prisma/client';
import { Transform } from 'class-transformer';

export class ScorecardQueryDto {
  @ApiProperty({ example: '2026-04-01' })
  @IsDateString()
  from: string;

  @ApiProperty({ example: '2026-04-30' })
  @IsDateString()
  to: string;

  @ApiProperty({ enum: IntegrationPlatform })
  @IsEnum(IntegrationPlatform)
  platform: IntegrationPlatform;

  @ApiProperty({ example: ['sessions', 'clicks'], required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  metricKeys?: string[];
}
