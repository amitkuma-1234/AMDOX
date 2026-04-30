import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { DomainEvent } from '../events/domain-events';

/**
 * Event Bus using EventEmitter2 with Outbox Pattern.
 * Events are persisted to the outbox_events table before being emitted.
 */
@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Publish a domain event.
   * 1. Store in outbox table (for reliability)
   * 2. Emit via EventEmitter2 (for in-process consumers)
   */
  async publish(eventType: string, event: DomainEvent): Promise<void> {
    this.logger.log(`Publishing event: ${eventType} for aggregate ${event.aggregateType}:${event.aggregateId}`);

    // 1. Persist to outbox (ensures at-least-once delivery)
    await this.prisma.outboxEvent.create({
      data: {
        eventType,
        aggregateId: event.aggregateId,
        aggregateType: event.aggregateType,
        payload: event.payload as any,
        tenantId: event.tenantId,
        processed: false,
      },
    });

    // 2. Emit for in-process listeners
    this.eventEmitter.emit(eventType, event);
  }

  /**
   * Subscribe to a domain event type.
   */
  on(eventType: string, handler: (event: DomainEvent) => void): void {
    this.eventEmitter.on(eventType, handler);
  }

  /**
   * Get unprocessed events from outbox (used by outbox consumer).
   */
  async getUnprocessedEvents(limit: number = 100) {
    return this.prisma.outboxEvent.findMany({
      where: { processed: false },
      orderBy: { timestamp: 'asc' },
      take: limit,
    });
  }

  /**
   * Mark event as processed.
   */
  async markProcessed(eventId: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id: eventId },
      data: { processed: true, processedAt: new Date() },
    });
  }

  /**
   * Mark event as failed with error.
   */
  async markFailed(eventId: string, error: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        retryCount: { increment: 1 },
        lastError: error,
      },
    });
  }
}
