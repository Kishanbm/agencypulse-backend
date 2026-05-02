import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SystemPrismaService } from '../../database/system-prisma.service';
import { PrismaService } from '../../database/prisma.service';
import { NotificationEventsService, NotificationPayload } from './notification-events.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { QueryNotificationsDto } from './dto/query-notifications.dto';

export type NotificationType =
  | 'ALERT_TRIGGERED'
  | 'SYNC_FAILED'
  | 'SYNC_CONNECTED'
  | 'REPORT_READY'
  | 'INVITE_ACCEPTED';

export interface CreateNotificationInput {
  tenantId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  resourceType?: string;
  resourceId?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemPrisma: SystemPrismaService,
    private readonly events: NotificationEventsService,
  ) {}

  /**
   * Create one notification and push it to any connected SSE subscribers.
   * Fire-and-forget safe — errors are logged, never thrown.
   */
  async create(input: CreateNotificationInput): Promise<void> {
    try {
      const notification = await this.systemPrisma.notification.create({
        data: {
          tenantId: input.tenantId,
          userId: input.userId,
          type: input.type,
          title: input.title,
          message: input.message ?? null,
          resourceType: input.resourceType ?? null,
          resourceId: input.resourceId ?? null,
        },
      });

      // Push to any active SSE stream for this user
      const payload: NotificationPayload = {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        resourceType: notification.resourceType,
        resourceId: notification.resourceId,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
      };
      this.events.emit(input.userId, payload);
    } catch (err) {
      this.logger.error('Failed to create notification', { input, err });
    }
  }

  /**
   * Notify all AGENCY_OWNER + AGENCY_ADMIN users in a tenant.
   * Used for system-level events (sync failures, alert triggers).
   */
  async notifyAdmins(
    tenantId: string,
    input: Omit<CreateNotificationInput, 'tenantId' | 'userId'>,
  ): Promise<void> {
    try {
      const admins = await this.systemPrisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM users
        WHERE tenant_id = ${tenantId}::uuid
          AND is_active = true
          AND role IN ('AGENCY_OWNER', 'AGENCY_ADMIN')
      `;
      await Promise.all(admins.map((a) => this.create({ ...input, tenantId, userId: a.id })));
    } catch (err) {
      this.logger.error('Failed to notify admins', { tenantId, input, err });
    }
  }

  // ─── Read API ──────────────────────────────────────────────────────────────

  async list(user: AuthenticatedUser, dto: QueryNotificationsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 30;
    const skip = (page - 1) * limit;

    const where: any = { tenantId: user.tenantId, userId: user.id };
    if (dto.isRead !== undefined) where.isRead = dto.isRead === 'true';

    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          resourceType: true,
          resourceId: true,
          isRead: true,
          readAt: true,
          createdAt: true,
        },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { tenantId: user.tenantId, userId: user.id, isRead: false },
      }),
    ]);

    return { items, total, unreadCount, page, limit };
  }

  async getUnreadCount(user: AuthenticatedUser): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { tenantId: user.tenantId, userId: user.id, isRead: false },
    });
    return { count };
  }

  async markRead(user: AuthenticatedUser, notificationId: string) {
    const existing = await this.prisma.notification.findFirst({
      where: { id: notificationId, tenantId: user.tenantId, userId: user.id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Notification not found.');

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });

    return { message: 'Notification marked as read.' };
  }

  async markAllRead(user: AuthenticatedUser) {
    await this.prisma.notification.updateMany({
      where: { tenantId: user.tenantId, userId: user.id, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    return { message: 'All notifications marked as read.' };
  }

  async delete(user: AuthenticatedUser, notificationId: string) {
    const existing = await this.prisma.notification.findFirst({
      where: { id: notificationId, tenantId: user.tenantId, userId: user.id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Notification not found.');

    await this.prisma.notification.delete({ where: { id: notificationId } });
    return { message: 'Notification deleted.' };
  }
}
