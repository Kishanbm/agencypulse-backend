import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'Acme Marketing' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  agencyName: string;

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

  // Password rules: min 8 chars, at least one uppercase, one lowercase, one digit
  // Enforced here AND documented in Swagger — no silent failures
  @ApiProperty({
    example: 'SecurePass1!',
    description:
      'Min 8 characters. Must contain uppercase, lowercase, and a number.',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password: string;
}
