import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GscAuthUrlDto {
  @ApiProperty({ description: 'Campaign ID to connect GSC to' })
  @IsUUID()
  campaignId!: string;
}
