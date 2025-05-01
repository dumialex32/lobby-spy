import { Controller, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

@Controller()
export class AppController {
  @Get()
  getHello(): string {
    return 'Hello World!';
  }

  @Get('rate-test')
  @Throttle(3, 60) // 3 requests per minute
  rateTest() {
    return {
      message: 'This is a rate limited endpoint',
      timestamp: new Date().toISOString(),
    };
  }
}
