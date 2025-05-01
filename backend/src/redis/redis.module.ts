import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisProvider } from './redis.provider';
import { REDIS_CLIENT } from './redis.constants';
import { RedisThrottlerStorage } from '../throttler/redis-throttler.storage';

@Module({
  imports: [ConfigModule],
  providers: [
    RedisProvider,
    {
      provide: REDIS_CLIENT,
      useFactory: (redisProvider: RedisProvider) => redisProvider.getClient(),
      inject: [RedisProvider],
    },
    RedisThrottlerStorage,
  ],
  exports: [REDIS_CLIENT, RedisProvider, RedisThrottlerStorage],
})
export class RedisModule {}
