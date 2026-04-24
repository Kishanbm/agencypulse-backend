import { IsString, IsNotEmpty, IsArray, IsOptional, IsInt, Min, Max, IsEmail, ArrayMaxSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateScheduleDto {
  @ApiProperty({ example: '0 8 * * 1', description: 'Cron expression (UTC)' })
  @IsString()
  @IsNotEmpty()
  cronExpression: string;

  @ApiProperty({ type: [String], description: 'Recipient email addresses (max 20)' })
  @IsArray()
  @IsEmail({}, { each: true })
  @ArrayMaxSize(20)
  recipientEmails: string[];

  @ApiPropertyOptional({ default: 30, description: 'Date range in days to include in the report' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  dateRangeDays?: number;
}
