import { IsUUID, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiKeyConnectDto {
  @ApiProperty({ description: 'Campaign UUID to connect the integration to.' })
  @IsUUID()
  campaignId: string;

  @ApiProperty({ description: 'API key or token issued by the platform.' })
  @IsString()
  apiKey: string;

  /** Some platforms (ActiveCampaign, Matomo) also require the account URL. */
  @ApiPropertyOptional({ description: 'Account base URL (required for self-hosted platforms like ActiveCampaign, Matomo).' })
  @IsOptional()
  @IsString()
  apiUrl?: string;

  /** Moz requires a separate accessId alongside the secret key. */
  @ApiPropertyOptional({ description: 'Access ID (used alongside apiKey for Moz).' })
  @IsOptional()
  @IsString()
  accessId?: string;

  /**
   * Raw externalAccountId value — use for platforms that need a specific JSON
   * config (e.g. MySQL, Matomo, WooCommerce). When provided, stored as-is and
   * takes precedence over the apiUrl/accessId JSON assembly.
   */
  @ApiPropertyOptional({ description: 'Raw externalAccountId string (JSON or plain) for complex platform configs.' })
  @IsOptional()
  @IsString()
  externalAccountId?: string;
}
