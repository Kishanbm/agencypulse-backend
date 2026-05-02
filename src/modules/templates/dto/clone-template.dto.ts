import { IsString, IsUUID, IsOptional, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CloneTemplateDto {
  @ApiProperty({ description: 'Target campaign to clone the template into' })
  @IsNotEmpty()
  @IsUUID()
  campaignId: string;

  @ApiPropertyOptional({ example: 'Q2 Review Dashboard', description: 'Name for the cloned dashboard/report' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;
}
