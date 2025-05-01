import { ThrottlerStorage } from '@nestjs/throttler';
import { Injectable, Logger, Inject } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { Histogram, Registry } from 'prom-client';

interface RedisThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private metrics!: {
    requests: Histogram<string>;
    blockedRequests: Histogram<string>;
  };

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly register: Registry = new Registry(),
  ) {
    this.setupMetrics();
  }

  private setupMetrics(): void {
    const requests = new Histogram({
      name: 'rate_limit_requests',
      help: 'Rate limit requests tracking',
      labelNames: ['key', 'status'] as const,
      registers: [this.register],
    });

    const blockedRequests = new Histogram({
      name: 'rate_limit_blocked_requests',
      help: 'Rate limit blocked requests count',
      labelNames: ['key'] as const,
      registers: [this.register],
    });

    this.metrics = {
      requests,
      blockedRequests,
    };
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): Promise<RedisThrottlerStorageRecord> {
    const endTimer = this.metrics.requests.startTimer({ key });

    try {
      // Get current state atomically using sliding window algorithm
      const now = Date.now();
      const windowStart = now - ttl * 1000;

      const results = await this.redis
        .multi()
        .zadd(key, now, now) // Add current timestamp to sorted set
        .zremrangebyscore(key, 0, windowStart) // Remove old timestamps
        .zcard(key) // Get count of current requests
        .expire(key, ttl) // Set TTL
        .exec();

      if (!results || results.length !== 4) {
        throw new Error('Redis command failed');
      }

      const [, , [, requestCount]] = results;
      const totalHits = Number(requestCount);

      if (isNaN(totalHits)) {
        throw new Error('Invalid Redis response value');
      }

      // Check if blocked
      const isBlocked = totalHits > limit;
      let timeToExpire = ttl;

      // Apply block if needed
      if (isBlocked) {
        await this.redis.expire(key, blockDuration);
        timeToExpire = blockDuration;
        this.logger.warn(
          `Request blocked for key "${key}" for ${blockDuration}ms. Total hits: ${totalHits}`,
        );
        this.metrics.blockedRequests.observe({ key }, 1);
      }

      endTimer({ status: isBlocked ? 'blocked' : 'allowed' });

      return {
        totalHits,
        timeToExpire,
        isBlocked,
        timeToBlockExpire: isBlocked ? blockDuration : 0,
      };
    } catch (error) {
      endTimer({ status: 'error' });
      this.logger.error(`Rate limit increment failed for key ${key}`, error);
      return {
        totalHits: 1,
        timeToExpire: ttl,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
  }
}
