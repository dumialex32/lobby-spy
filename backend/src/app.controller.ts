import { Controller, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

@Controller()
export class AppController {
  @Get()
  getHello(): string {
    return 'Hello World!';
  }

  @Get('rate-test')
  @Throttle({ default: { limit: 3, ttl: 60 } })
  rateTest(): { message: string; timestamp: string } {
    return {
      message: 'This is a rate limited endpoint',
      timestamp: new Date().toISOString(),
    };
  }
}
