import {
  IsString,
  IsOptional,
  MaxLength,
  MinLength,
  Matches,
  IsUrl,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAgencyDto {
  @ApiPropertyOptional({ example: 'Acme Marketing Agency' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    example: 'acme-agency',
    description: 'URL-safe slug used for subdomain: <slug>.agencypulse.com',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  // Only lowercase letters, numbers, hyphens. No leading/trailing hyphens.
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase letters, numbers, and hyphens only (e.g. my-agency)',
  })
  slug?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/logo.png' })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  logoUrl?: string;

  @ApiPropertyOptional({ example: '#3B82F6', description: 'Brand color (hex)' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'primaryColor must be a valid hex color (e.g. #3B82F6)' })
  primaryColor?: string;

  @ApiPropertyOptional({ example: 'reports.myagency.com' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  customDomain?: string;
}
