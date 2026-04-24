import {
  Controller,
  Post,
  Body,
  NotFoundException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { PrismaService } from '../../database/prisma.service';
import { SyncService } from './sync.service';
import { SyncSchedulerService } from './sync-scheduler.service';
import { ManualTriggerDto } from './dto/sync-job.dto';

@ApiTags('sync')
@Controller('sync')
export class SyncController {
  constructor(
    private readonly syncService: SyncService,
    private readonly scheduler: SyncSchedulerService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * POST /sync/trigger
   *
   * Manually dispatches a sync job for a campaign.
   * Used during development and testing — Phase 3.6 replaces manual triggering
   * with an automatic cron schedule.
   *
   * AGENCY_ADMIN+ only — staff and clients cannot trigger manual syncs.
   */
  @Post('trigger')
  @Roles(UserRole.AGENCY_ADMIN)
  @ApiOperation({
    summary: 'Manually trigger a data sync for a campaign.',
    description:
      'Dispatches BullMQ sync job(s). If platform is omitted, all connected platforms are synced. ' +
      'Duplicate jobs for the same date window are ignored (deterministic jobId).',
  })
  async trigger(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ManualTriggerDto,
  ): Promise<{ dispatched: number }> {
    // Validate campaign access — same tenantId scoping, soft-delete guards
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        id: dto.campaignId,
        tenantId: user.tenantId,
        deletedAt: null,
        client: { deletedAt: null },
      },
      select: { id: true },
    });

    if (!campaign) throw new NotFoundException('Campaign not found.');

    if (dto.platform) {
      await this.syncService.dispatchSync(user.tenantId, campaign.id, dto.platform);
      return { dispatched: 1 };
    }

    const dispatched = await this.syncService.dispatchCampaignSync(user.tenantId, campaign.id);
    return { dispatched };
  }

  /**
   * POST /sync/scheduler/run
   *
   * Dev/test endpoint — manually executes one full scheduler cycle immediately.
   * Identical to the cron-triggered path but called on-demand.
   * AGENCY_ADMIN only (same guard as /sync/trigger).
   */
  @Post('scheduler/run')
  @Roles(UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'Dev: manually execute one scheduler cycle.' })
  async runScheduler(): Promise<{ ok: boolean }> {
    await this.scheduler.runScheduledSync();
    return { ok: true };
  }
}
