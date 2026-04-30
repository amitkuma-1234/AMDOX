import { Controller, Get, Param, Patch, Query, Sse, MessageEvent, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Observable, interval, switchMap, from, map } from 'rxjs';
import { NotificationService } from '../services/notification.service';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Get user notifications (paginated)' })
  async getUserNotifications(
    @Query('userId') userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.notificationService.getUserNotifications(userId, page, limit);
  }

  @Get('badge')
  @ApiOperation({ summary: 'Get unread notification count for badge display' })
  async getBadgeCount(@Query('userId') userId: string) {
    const count = await this.notificationService.getBadgeCount(userId);
    return { unread: count };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markRead(@Param('id', ParseUUIDPipe) id: string) {
    return this.notificationService.markRead(id);
  }

  @Sse('stream')
  @ApiOperation({ summary: 'SSE stream for real-time in-app notifications' })
  notificationStream(@Query('userId') userId: string): Observable<MessageEvent> {
    // Poll for new notifications every 5 seconds
    return interval(5000).pipe(
      switchMap(() => from(this.notificationService.getBadgeCount(userId))),
      map((count) => ({
        data: JSON.stringify({
          type: 'badge_update',
          unread: count,
          timestamp: new Date().toISOString(),
        }),
        type: 'notification',
      })),
    );
  }
}
