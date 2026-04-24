import { IsEnum, IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IntegrationPlatform } from '@prisma/client';
import { Type } from 'class-transformer';

export class BrowseTemplatesDto {
  @ApiPropertyOptional({ example: 'Google Ads' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ enum: IntegrationPlatform })
  @IsOptional()
  @IsEnum(IntegrationPlatform)
  platform?: IntegrationPlatform;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt() @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt() @Min(1) @Max(100)
  limit?: number;
}
