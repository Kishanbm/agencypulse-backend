import { ApiProperty } from '@nestjs/swagger';
import { UserRole, AgencyPlan } from '@prisma/client';

export class AuthUserDto {
  @ApiProperty() id: string;
  @ApiProperty() tenantId: string;
  @ApiProperty() email: string;
  @ApiProperty() firstName: string;
  @ApiProperty() lastName: string;
  @ApiProperty({ nullable: true }) avatarUrl: string | null;
  @ApiProperty({ enum: UserRole }) role: UserRole;
}

export class AuthAgencyDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
  @ApiProperty({ nullable: true }) logoUrl: string | null;
  @ApiProperty({ nullable: true }) primaryColor: string | null;
  @ApiProperty({ enum: AgencyPlan }) plan: AgencyPlan;
}

export class AuthResponseDto {
  @ApiProperty({ description: 'Short-lived JWT access token (15 min)' })
  accessToken: string;

  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;

  @ApiProperty({ type: AuthAgencyDto })
  agency: AuthAgencyDto;
}

export class RefreshResponseDto {
  @ApiProperty({ description: 'New short-lived JWT access token (15 min)' })
  accessToken: string;
}
