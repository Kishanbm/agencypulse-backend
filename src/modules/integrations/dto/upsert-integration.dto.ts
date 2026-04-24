import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IntegrationPlatform } from '@prisma/client';

export class UpsertIntegrationDto {
  @ApiProperty({ enum: IntegrationPlatform, description: 'The platform to connect.' })
  @IsEnum(IntegrationPlatform)
  platform: IntegrationPlatform;

  // Raw OAuth tokens — only required during the OAuth callback flow.
  // If not provided, any existing stored tokens are preserved (not overwritten).
  @ApiPropertyOptional({ description: 'Raw OAuth access token (will be encrypted at rest).' })
  @IsOptional()
  @IsString()
  accessToken?: string;

  @ApiPropertyOptional({ description: 'Raw OAuth refresh token (will be encrypted at rest).' })
  @IsOptional()
  @IsString()
  refreshToken?: string;

  @ApiPropertyOptional({ description: 'ISO 8601 datetime when the access token expires.' })
  @IsOptional()
  @IsDateString()
  tokenExpiresAt?: string;

  @ApiPropertyOptional({ description: 'ISO 8601 datetime when the refresh token expires (if applicable).' })
  @IsOptional()
  @IsDateString()
  refreshTokenExpiresAt?: string;

  @ApiPropertyOptional({ description: 'OAuth scopes granted by the user (space-separated).' })
  @IsOptional()
  @IsString()
  scopes?: string;

  @ApiPropertyOptional({ description: 'Platform-specific account identifier (e.g. GA4 property ID).' })
  @IsOptional()
  @IsString()
  externalAccountId?: string;

  @ApiPropertyOptional({ description: 'Account type differentiator (e.g. "MCC" vs "individual" for Google Ads).' })
  @IsOptional()
  @IsString()
  platformAccountType?: string;
}
