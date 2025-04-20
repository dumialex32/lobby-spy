import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  app.enableCors({
    origin: 'http://localhost:5713', // Allow only frontend domain
    credentials: true, // Allow cookies to be sent with requests
  });

  await app.listen(3000);
}

// Await bootstrap to handle the promise
bootstrap().catch((error) => {
  console.error('Error starting the app:', error);
});
