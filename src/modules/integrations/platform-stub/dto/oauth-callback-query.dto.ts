import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OAuthCallbackDto {
  @ApiPropertyOptional({ description: 'Authorization code from the OAuth provider.' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ description: 'State JWT for CSRF protection.' })
  @IsString()
  state: string;

  /** TikTok and some platforms return auth_code instead of code */
  @ApiPropertyOptional({ description: 'Authorization code (alternative field name used by some platforms).' })
  @IsOptional()
  @IsString()
  auth_code?: string;

  /** Some platforms return an error in the callback */
  @ApiPropertyOptional({ description: 'Error code returned by the OAuth provider on denial.' })
  @IsOptional()
  @IsString()
  error?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  error_description?: string;

  /** BigCommerce sends a `context` param (e.g. "stores/abc123") required in token exchange. */
  @ApiPropertyOptional({ description: 'BigCommerce store context identifier.' })
  @IsOptional()
  @IsString()
  context?: string;

  /** Google sometimes sends `iss` and `scope` in the callback */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  iss?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scope?: string;

  /** Shopify sends these in the callback */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hmac?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  host?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shop?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timestamp?: string;
}
