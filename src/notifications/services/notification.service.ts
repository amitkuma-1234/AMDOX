import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { TemplateService } from './template.service';
import { DomainEvent } from '../events/domain-events';

/**
 * Multi-channel notification dispatch service.
 * Channels: in-app (SSE), email, webhook.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly templateService: TemplateService,
    @InjectQueue('email') private readonly emailQueue: Queue,
    @InjectQueue('webhook') private readonly webhookQueue: Queue,
  ) {}

  /**
   * Dispatch notification based on user preferences.
   */
  async dispatchForEvent(eventType: string, event: DomainEvent): Promise<void> {
    // Find users with preferences for this event type in this tenant
    const preferences = await this.prisma.notificationPreference.findMany({
      where: {
        eventType,
        isEnabled: true,
      },
    });

    for (const pref of preferences) {
      // Check quiet hours
      if (this.isQuietHours(pref.quietStart, pref.quietEnd)) {
        this.logger.debug(`Skipping notification for user ${pref.userId} — quiet hours`);
        continue;
      }

      for (const channel of pref.channels) {
        switch (channel) {
          case 'IN_APP':
            await this.createInAppNotification(pref.userId, eventType, event);
            break;
          case 'EMAIL':
            await this.queueEmail(pref.userId, eventType, event);
            break;
          default:
            break;
        }
      }
    }

    // Dispatch to webhook endpoints
    await this.dispatchWebhooks(event.tenantId, eventType, event);
  }

  private async createInAppNotification(userId: string, eventType: string, event: DomainEvent) {
    const { title, body } = this.templateService.render(eventType, event.payload);

    await this.prisma.notification.create({
      data: {
        title,
        body,
        type: 'INFO',
        channel: 'IN_APP',
        status: 'PENDING',
        metadata: { eventType, aggregateId: event.aggregateId },
        userId,
      },
    });
  }

  private async queueEmail(userId: string, eventType: string, event: DomainEvent) {
    const { title, body } = this.templateService.render(eventType, event.payload);

    await this.emailQueue.add('send-email', {
      userId,
      subject: title,
      body,
      eventType,
      tenantId: event.tenantId,
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
  }

  private async dispatchWebhooks(tenantId: string, eventType: string, event: DomainEvent) {
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        eventTypes: { has: eventType },
      },
    });

    for (const endpoint of endpoints) {
      await this.webhookQueue.add('send-webhook', {
        endpointId: endpoint.id,
        url: endpoint.url,
        secret: endpoint.secret,
        eventType,
        payload: event.payload,
        tenantId,
      }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      });
    }
  }

  /**
   * Get unread notification count for badge display.
   */
  async getBadgeCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, readAt: null, deletedAt: null },
    });
  }

  /**
   * Get notifications for a user (paginated).
   */
  async getUserNotifications(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId, deletedAt: null } }),
    ]);

    return { data: items, meta: { total, page, limit, unread: await this.getBadgeCount(userId) } };
  }

  /**
   * Mark notification as read.
   */
  async markRead(notificationId: string) {
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date(), status: 'READ' },
    });
  }

  private isQuietHours(start: string | null, end: string | null): boolean {
    if (!start || !end) return false;
    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const currentTime = currentHour * 60 + currentMin;

    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    const startTime = startH * 60 + startM;
    const endTime = endH * 60 + endM;

    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime < endTime;
    }
    // Crosses midnight (e.g., 21:00 - 07:00)
    return currentTime >= startTime || currentTime < endTime;
  }
}
