import { IsString, IsOptional, MaxLength, Matches, IsEmail } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const PLATFORM_DOMAIN_PATTERN = /agencypulse\.com$/i;

export class UpdateBrandingDto {
  @ApiPropertyOptional({ example: '#3B82F6' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Must be a valid hex color e.g. #3B82F6' })
  primaryColor?: string;

  @ApiPropertyOptional({ example: '#1E40AF' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Must be a valid hex color e.g. #1E40AF' })
  secondaryColor?: string;

  @ApiPropertyOptional({ example: 'reports.myagency.com' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  customDomain?: string;

  @ApiPropertyOptional({ example: 'Acme Marketing' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  emailFromName?: string;

  @ApiPropertyOptional({ example: 'reports@myagency.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  emailFromAddress?: string;

  // Note: slug is managed via PATCH /agencies/me — not allowed here
}
