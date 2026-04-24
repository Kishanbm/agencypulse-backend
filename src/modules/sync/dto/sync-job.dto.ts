import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { IntegrationPlatform } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Payload stored in every BullMQ job on the integration-sync queue */
export interface SyncJobPayload {
  tenantId: string;
  campaignId: string;
  campaignName: string;
  platform: IntegrationPlatform;
  dateRange: {
    from: string; // YYYY-MM-DD UTC
    to: string;   // YYYY-MM-DD UTC
  };
}

/** Body for POST /sync/trigger — manual sync for development/testing */
export class ManualTriggerDto {
  @ApiProperty({ description: 'Campaign ID to sync.' })
  @IsUUID()
  campaignId: string;

  @ApiPropertyOptional({
    enum: IntegrationPlatform,
    description: 'Specific platform to sync. Omit to sync all connected platforms.',
  })
  @IsOptional()
  @IsEnum(IntegrationPlatform)
  platform?: IntegrationPlatform;
}
