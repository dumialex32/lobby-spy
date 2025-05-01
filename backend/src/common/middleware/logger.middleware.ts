import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl } = req;
    const traceId = uuidv4();

    res.setHeader('X-Trace-Id', traceId);

    const start = Date.now();
    res.on('finish', () => {
      const { statusCode } = res;
      const duration = Date.now() - start;

      this.logger.log({
        message: `${method} ${originalUrl}`,
        status: statusCode,
        duration: `${duration}ms`,
        traceId,
        userAgent: req.headers['user-agent'],
      });
    });

    next();
  }
}
