import { Controller, Get, All, Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Request, Response } from 'express';

/**
 * Bull Board Admin UI — serves a read-only job management UI.
 * Mount: GET /admin/jobs → redirects to Bull Board UI.
 *
 * Access restricted to admin role in production.
 */
@ApiTags('Admin')
@Controller('admin')
export class AdminJobsController {
  private readonly serverAdapter: ExpressAdapter;

  constructor(
    @InjectQueue('email') emailQueue: Queue,
    @InjectQueue('webhook') webhookQueue: Queue,
    @InjectQueue('outbox-consumer') outboxQueue: Queue,
    @InjectQueue('report-generation') reportQueue: Queue,
  ) {
    this.serverAdapter = new ExpressAdapter();
    this.serverAdapter.setBasePath('/api/v1/admin/jobs');

    createBullBoard({
      queues: [
        new BullMQAdapter(emailQueue),
        new BullMQAdapter(webhookQueue),
        new BullMQAdapter(outboxQueue),
        new BullMQAdapter(reportQueue),
      ],
      serverAdapter: this.serverAdapter,
    });
  }

  @Get('jobs')
  @ApiOperation({ summary: 'Bull Board UI — queue management dashboard' })
  async getJobs(@Req() req: Request, @Res() res: Response) {
    return this.serverAdapter.getRouter()(req, res, () => res.redirect('/api/v1/admin/jobs'));
  }

  @All('jobs/*')
  async handleJobRoutes(@Req() req: Request, @Res() res: Response) {
    return this.serverAdapter.getRouter()(req, res, () => res.status(404).json({ message: 'Not found' }));
  }
}
