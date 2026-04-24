import { Injectable, Logger } from '@nestjs/common';
import { SystemPrismaService } from '../../database/system-prisma.service';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'RESTORE'
  | 'CONNECT'
  | 'DISCONNECT'
  | 'GENERATE'
  | 'INVITE'
  | 'REVOKE';

export interface AuditEntry {
  tenantId: string;
  userId?: string;
  userEmail?: string;
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  resourceName?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly systemPrisma: SystemPrismaService) {}

  /**
   * Fire-and-forget audit log write.
   * Never throws — a logging failure must never break the main operation.
   */
  log(entry: AuditEntry): void {
    this.systemPrisma.auditLog
      .create({
        data: {
          tenantId: entry.tenantId,
          userId: entry.userId ?? null,
          userEmail: entry.userEmail ?? null,
          action: entry.action,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId ?? null,
          resourceName: entry.resourceName ?? null,
          metadata: (entry.metadata as any) ?? undefined,
          ipAddress: entry.ipAddress ?? null,
        },
      })
      .catch((err: unknown) => {
        this.logger.error('Failed to write audit log', { entry, err });
      });
  }
}
