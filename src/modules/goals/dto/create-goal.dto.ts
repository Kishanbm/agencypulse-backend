import {
  IsString, IsNotEmpty, IsEnum, IsDateString,
  IsNumber, Min, MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IntegrationPlatform } from '@prisma/client';

// GoalPeriodType not yet in generated client — remove when prisma generate is run
enum GoalPeriodType {
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
}

export class CreateGoalDto {
  @ApiProperty({ example: 'Reach 10k sessions' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ enum: IntegrationPlatform })
  @IsEnum(IntegrationPlatform)
  platform: IntegrationPlatform;

  @ApiProperty({ example: 'sessions' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  metricKey: string;

  @ApiProperty({ example: 10000 })
  @IsNumber()
  @Min(0)
  targetValue: number;

  @ApiProperty({ enum: GoalPeriodType, default: GoalPeriodType.MONTHLY })
  @IsEnum(GoalPeriodType)
  periodType: GoalPeriodType;

  @ApiProperty({ example: '2026-04-01' })
  @IsDateString()
  periodStart: string;

  @ApiProperty({ example: '2026-04-30' })
  @IsDateString()
  periodEnd: string;
}
