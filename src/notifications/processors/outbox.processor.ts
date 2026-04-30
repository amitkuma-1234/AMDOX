import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EventBusService } from '../services/event-bus.service';
import { NotificationService } from '../services/notification.service';

@Processor('outbox-consumer')
export class OutboxProcessor extends WorkerHost {
  private readonly logger = new Logger(OutboxProcessor.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly notificationService: NotificationService,
  ) { super(); }

  async process(job: Job): Promise<void> {
    const events = await this.eventBus.getUnprocessedEvents(50);
    this.logger.debug(`Processing ${events.length} outbox events`);

    for (const event of events) {
      try {
        await this.notificationService.dispatchForEvent(event.eventType, {
          tenantId: event.tenantId,
          aggregateId: event.aggregateId,
          aggregateType: event.aggregateType,
          payload: event.payload as Record<string, any>,
          timestamp: event.timestamp,
        });
        await this.eventBus.markProcessed(event.id);
      } catch (error) {
        this.logger.error(`Outbox event ${event.id} failed: ${error.message}`);
        await this.eventBus.markFailed(event.id, error.message);
      }
    }
  }
}
