import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { NotificationController } from './controllers/notification.controller';
import { EventBusService } from './services/event-bus.service';
import { NotificationService } from './services/notification.service';
import { TemplateService } from './services/template.service';
import { EmailProcessor } from './processors/email.processor';
import { WebhookProcessor } from './processors/webhook.processor';
import { OutboxProcessor } from './processors/outbox.processor';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    DatabaseModule,
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
      verboseMemoryLeak: true,
    }),
    BullModule.registerQueue(
      { name: 'email' },
      { name: 'webhook' },
      { name: 'outbox-consumer' },
    ),
  ],
  controllers: [NotificationController],
  providers: [
    EventBusService,
    NotificationService,
    TemplateService,
    EmailProcessor,
    WebhookProcessor,
    OutboxProcessor,
  ],
  exports: [EventBusService, NotificationService],
})
export class NotificationsModule {}
