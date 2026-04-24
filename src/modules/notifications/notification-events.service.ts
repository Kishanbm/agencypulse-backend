import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';

export interface NotificationPayload {
  id: string;
  type: string;
  title: string;
  message: string | null;
  resourceType: string | null;
  resourceId: string | null;
  isRead: boolean;
  createdAt: Date;
}

/**
 * In-process event bus for real-time notification delivery via SSE.
 * Each connected client subscribes to events keyed by userId.
 * Scale note: single-server only. Replace with Redis pub/sub for horizontal scaling.
 */
@Injectable()
export class NotificationEventsService extends EventEmitter {
  emit(userId: string, payload: NotificationPayload): boolean {
    return super.emit(userId, payload);
  }

  onNotification(userId: string, handler: (payload: NotificationPayload) => void): this {
    return this.on(userId, handler);
  }

  offNotification(userId: string, handler: (payload: NotificationPayload) => void): this {
    return this.off(userId, handler);
  }
}
