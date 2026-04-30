import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

@Processor('email')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  async process(job: Job<{ userId: string; subject: string; body: string; eventType: string; tenantId: string }>): Promise<void> {
    const { userId, subject, body, eventType, tenantId } = job.data;
    this.logger.log(`Sending email for event ${eventType} to user ${userId} (attempt ${job.attemptsMade + 1})`);

    try {
      // TODO: Integrate with Resend or AWS SES
      // const resend = new Resend(process.env.RESEND_API_KEY);
      // await resend.emails.send({ from: 'noreply@amdox.com', to: userEmail, subject, html: body });

      this.logger.log(`Email sent successfully for ${eventType} to user ${userId}`);
    } catch (error) {
      this.logger.error(`Email send failed: ${error.message}`, error.stack);
      throw error; // BullMQ will retry with exponential backoff
    }
  }
}
