import {
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Param,
  Query,
  UseGuards,
  Sse,
  MessageEvent,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { NotificationsService } from './notifications.service';
import { NotificationEventsService, NotificationPayload } from './notification-events.service';
import { QueryNotificationsDto } from './dto/query-notifications.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly events: NotificationEventsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for the current user' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() dto: QueryNotificationsDto) {
    return this.notificationsService.list(user, dto);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count (for bell badge)' })
  unreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.getUnreadCount(user);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a single notification as read' })
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationsService.markRead(user, id);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllRead(user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationsService.delete(user, id);
  }

  /**
   * SSE stream — client keeps this connection open; server pushes new notifications instantly.
   *
   * Usage (frontend):
   *   const es = new EventSource('/api/v1/notifications/stream', { withCredentials: true });
   *   es.onmessage = (e) => { const n = JSON.parse(e.data); ... };
   *
   * The stream also sends a heartbeat comment every 30s to prevent proxy timeouts.
   */
  @Sse('stream')
  @ApiOperation({ summary: 'SSE stream — real-time notification delivery' })
  stream(@CurrentUser() user: AuthenticatedUser): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      // Send an initial heartbeat so the client knows the connection is alive
      subscriber.next({ data: JSON.stringify({ type: 'CONNECTED' }) } as MessageEvent);

      const handler = (payload: NotificationPayload) => {
        subscriber.next({ data: JSON.stringify(payload) } as MessageEvent);
      };

      this.events.onNotification(user.id, handler);

      // Heartbeat every 30s — prevents Nginx/proxy from closing idle connections
      const heartbeat = setInterval(() => {
        subscriber.next({ data: JSON.stringify({ type: 'HEARTBEAT' }) } as MessageEvent);
      }, 30_000);

      // Cleanup when client disconnects
      return () => {
        this.events.offNotification(user.id, handler);
        clearInterval(heartbeat);
      };
    });
  }
}
