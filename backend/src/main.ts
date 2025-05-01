import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import { ThrottlerExceptionFilter } from './common/filters/throttler-exception.filter';
import { Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-esceptions-filter';
import { LoggerMiddleware } from './common/middleware/logger.middleware';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
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

  const middleware = new LoggerMiddleware();
  app.use(middleware.use.bind(middleware));

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

  app.use(cookieParser());

  app.enableCors({
    origin:
      process.env.NODE_ENV === 'production'
        ? process.env.PROD_FRONTEND_URL
        : process.env.DEV_FRONTEND_URL,
    credentials: true,
  });

  app.setGlobalPrefix('api');

  await app.listen(3000);
  logger.log(`Application running on ${await app.getUrl()}`);
}

bootstrap().catch((error) => {
  console.error('Error starting the app:', error);
  process.exit(1);
});
