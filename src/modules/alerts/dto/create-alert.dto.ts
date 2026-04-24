import {
  IsString, IsNotEmpty, IsEnum, IsNumber, Min, MaxLength,
  IsEmail, IsArray, IsOptional, IsInt, Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IntegrationPlatform } from '@prisma/client';

// Enums not yet in generated client — mirrors migration SQL
export enum AlertCondition {
  ABOVE = 'ABOVE',
  BELOW = 'BELOW',
  PERCENT_CHANGE_ABOVE = 'PERCENT_CHANGE_ABOVE',
  PERCENT_CHANGE_BELOW = 'PERCENT_CHANGE_BELOW',
}

export enum AlertPeriodType {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
}

export enum AlertSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

export class CreateAlertDto {
  @ApiProperty({ example: 'Sessions dropped below baseline' })
  @IsString() @IsNotEmpty() @MaxLength(255)
  name: string;

  @ApiProperty({ enum: IntegrationPlatform })
  @IsEnum(IntegrationPlatform)
  platform: IntegrationPlatform;

  @ApiProperty({ example: 'sessions' })
  @IsString() @IsNotEmpty() @MaxLength(100)
  metricKey: string;

  @ApiProperty({ enum: AlertCondition })
  @IsEnum(AlertCondition)
  condition: AlertCondition;

  @ApiProperty({ example: 500 })
  @IsNumber() @Min(0)
  threshold: number;

  @ApiProperty({ enum: AlertPeriodType, default: AlertPeriodType.DAILY })
  @IsEnum(AlertPeriodType)
  periodType: AlertPeriodType;

  @ApiProperty({ enum: AlertSeverity, default: AlertSeverity.WARNING })
  @IsOptional()
  @IsEnum(AlertSeverity)
  severity?: AlertSeverity;

  @ApiProperty({ type: [String], example: ['cto@agency.com'] })
  @IsArray()
  @IsEmail({}, { each: true })
  recipientEmails: string[];

  @ApiProperty({ example: 24, description: 'Hours before this alert can fire again' })
  @IsOptional()
  @IsInt() @Min(1) @Max(168)
  cooldownHours?: number;
}
