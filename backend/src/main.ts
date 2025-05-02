import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import { ThrottlerExceptionFilter } from './common/filters/throttler-exception.filter';
import { Logger } from '@nestjs/common';
import helmet from 'helmet';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { Request, Response, NextFunction } from 'express';
import { AllExceptionsFilter } from './common/filters/all-esceptions-filter';

/**
 * Application Bootstrap
 * @description Configures and starts the NestJS application
 * @function bootstrap
 */
async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const metricsLogger = new Logger('MetricsMiddleware');

  try {
    const app = await NestFactory.create(AppModule, {
      logger: ['log', 'error', 'warn', 'debug', 'verbose'],
      bufferLogs: true,
    });

    // Security middleware
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:'],
          },
        },
      }),
    );

    // Metrics endpoint protection
    app.use('/metrics', (req: Request, res: Response, next: NextFunction) => {
      if (process.env.NODE_ENV === 'test') return next();

      const auth = req.headers.authorization;
      const metricsToken = process.env.METRICS_TOKEN;

      if (!metricsToken) {
        metricsLogger.error('Metrics token not configured');
        return res.status(500).send('Metrics configuration error');
      }

      if (!auth || auth !== `Bearer ${metricsToken}`) {
        metricsLogger.warn('Unauthorized metrics access attempt');
        return res.status(403).send('Forbidden');
      }

      next();
    });

    // Create middleware instance and use it
    const loggerMiddleware = new LoggerMiddleware();
    app.use(loggerMiddleware.use.bind(loggerMiddleware));

    // Global pipes and filters
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        disableErrorMessages: process.env.NODE_ENV === 'production',
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    app.useGlobalFilters(
      new ThrottlerExceptionFilter(),
      new AllExceptionsFilter(),
    );

    // Cookie and CORS setup
    app.use(cookieParser());
    app.enableCors({
      origin:
        process.env.NODE_ENV === 'production'
          ? process.env.PROD_FRONTEND_URL
          : process.env.DEV_FRONTEND_URL,
      credentials: true,
    });

    // Global prefix
    app.setGlobalPrefix('api');

    // Start application
    await app.listen(3000);
    logger.log(`Application running on ${await app.getUrl()}`);
  } catch (error) {
    logger.error(
      'Failed to start application',
      error instanceof Error ? error.stack : error,
    );
    process.exit(1);
  }
}

bootstrap().catch((error: unknown) => {
  console.error(
    'Bootstrap error:',
    error instanceof Error ? error.stack : error,
  );
  process.exit(1);
});
