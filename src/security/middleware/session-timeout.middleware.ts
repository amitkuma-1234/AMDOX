import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Session Timeout Middleware — enforces 15-minute inactivity timeout.
 * Sets last-activity timestamp on each authenticated request.
 * If inactivity exceeds SESSION_TIMEOUT_MS, clears session and responds 401.
 */
@Injectable()
export class SessionTimeoutMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SessionTimeoutMiddleware.name);
  private readonly TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

  use(req: Request, res: Response, next: NextFunction): void {
    // Only enforce for authenticated sessions
    const user = (req as any).user;
    if (!user) return next();

    const now = Date.now();
    const session = (req as any).session as Record<string, any> | undefined;
    if (!session) return next();

    const lastActivity = session['lastActivityAt'] as number | undefined;

    if (lastActivity && now - lastActivity > this.TIMEOUT_MS) {
      this.logger.warn(`Session timeout for user ${user.sub} — inactive for ${Math.round((now - lastActivity) / 1000)}s`);

      // Clear session
      if (typeof session.destroy === 'function') {
        session.destroy((err: any) => { if (err) this.logger.error('Session destroy error:', err); });
      }

      res.status(401).json({
        statusCode: 401,
        message: 'Session expired due to inactivity. Please log in again.',
        error: 'SESSION_TIMEOUT',
      });
      return;
    }

    // Update last activity
    session['lastActivityAt'] = now;
    next();
  }
}
