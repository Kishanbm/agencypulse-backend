import { IsUUID, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PlatformAuthUrlDto {
  @ApiProperty({ description: 'Campaign UUID to connect the integration to.' })
  @IsUUID()
  campaignId: string;

  /** Required for per-shop platforms like Shopify and BigCommerce. */
  @ApiPropertyOptional({ description: 'Shop domain (e.g. mystore.myshopify.com). Required for per-shop platforms.' })
  @IsOptional()
  @IsString()
  shopDomain?: string;
}
