import { IsString, IsNotEmpty, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IntegrationPlatform } from '@prisma/client';

export class CreateKpiDefinitionDto {
  @ApiProperty({ example: 'My ROAS' })
  @IsString() @IsNotEmpty() @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'revenue / spend', description: 'Math expression using metric keys as variables' })
  @IsString() @IsNotEmpty() @MaxLength(500)
  formula: string;

  @ApiProperty({ enum: IntegrationPlatform })
  @IsEnum(IntegrationPlatform)
  platform: IntegrationPlatform;
}
