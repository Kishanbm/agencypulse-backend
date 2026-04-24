import { IsDateString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IntegrationPlatform } from '@prisma/client';

export class KpiQueryDto {
  @ApiProperty({ enum: IntegrationPlatform })
  @IsEnum(IntegrationPlatform)
  platform: IntegrationPlatform;

  @ApiProperty({ example: '2026-04-01' })
  @IsDateString()
  from: string;

  @ApiProperty({ example: '2026-04-30' })
  @IsDateString()
  to: string;
}
