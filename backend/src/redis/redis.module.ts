import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisProvider } from './redis.provider';
import { REDIS_CLIENT } from './redis.constants';
import { RedisThrottlerStorage } from '../throttler/redis-throttler.storage';

/**
 * RedisModule handles Redis client instantiation and configuration,
 * including cluster support and custom providers.
 *
 * Exposes RedisProvider, RedisThrottlerStorage, and the raw Redis client
 * through DI for usage across the application.
 */
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
