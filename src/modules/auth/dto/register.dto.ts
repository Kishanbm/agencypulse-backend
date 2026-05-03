import {
  IsEmail,
  IsString,
  IsOptional,
  IsArray,
  MinLength,
  MaxLength,
  Matches,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  // ─── Step 1: Account ───────────────────────────────────────────────────────
  @ApiProperty({ example: 'Jane' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @ApiProperty({ example: 'jane@acmemarketing.com' })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({
    example: 'SecurePass1!',
    description:
      'Min 8 characters. Must contain uppercase, lowercase, and a number.',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password: string;

  @ApiPropertyOptional({ example: '+1 415 555 0100' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  // ─── Step 2: Agency profile ────────────────────────────────────────────────
  @ApiProperty({ example: 'Acme Marketing' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  agencyName: string;

  @ApiPropertyOptional({ example: 'https://acmemarketing.com' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  website?: string;

  @ApiPropertyOptional({ enum: ['1', '2-5', '6-10', '11-25', '26-50', '51+'] })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  size?: string;

  @ApiPropertyOptional({ example: 'US', description: 'ISO 3166-1 alpha-2 country code' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;

  @ApiPropertyOptional({ example: 'America/Los_Angeles' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  // ─── Step 3: Use-case (skippable) ─────────────────────────────────────────
  @ApiPropertyOptional({
    example: ['SEO', 'PPC', 'SOCIAL'],
    description: 'Categories the agency wants to track',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @ApiPropertyOptional({ enum: ['1-5', '6-15', '16-50', '51-100', '100+'] })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  clientCountEstimate?: string;

  @ApiPropertyOptional({
    enum: ['SEARCH', 'SOCIAL', 'REFERRAL', 'PODCAST', 'BLOG', 'OTHER'],
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  referralSource?: string;
}
