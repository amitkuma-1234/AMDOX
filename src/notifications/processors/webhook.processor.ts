import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { createHmac } from 'crypto';

@Processor('webhook')
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);

  async process(job: Job): Promise<void> {
    const { url, secret, eventType, payload, tenantId } = job.data;
    this.logger.log(`Webhook -> ${url} for ${eventType}`);

    const body = JSON.stringify({ event: eventType, payload, tenantId, timestamp: new Date().toISOString() });
    const signature = createHmac('sha256', secret).update(body).digest('hex');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AMDOX-Signature': `sha256=${signature}`,
        'X-AMDOX-Event': eventType,
      },
      body,
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) throw new Error(`Webhook failed: ${response.status}`);
    this.logger.log(`Webhook delivered: ${response.status}`);
  }
}
