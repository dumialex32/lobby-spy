import { Injectable, Inject } from '@nestjs/common';
import {
  HealthCheckService,
  HttpHealthIndicator,
  MemoryHealthIndicator,
  HealthIndicatorFunction,
  HealthCheckResult,
} from '@nestjs/terminus';
import { RedisProvider } from '../redis/redis.provider';
import { PrismaHealthIndicator } from './prisma.health';

interface HealthCheckConfig {
  apiEndpoint: string;
  memoryThreshold: number;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly health: HealthCheckService,
    private readonly http: HttpHealthIndicator,
    private readonly redis: RedisProvider,
    private readonly memory: MemoryHealthIndicator,
    private readonly prisma: PrismaHealthIndicator,
    @Inject('HEALTH_CHECK_CONFIG')
    private readonly config: HealthCheckConfig,
  ) {}

  async getHealthCheck(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.http.pingCheck('api', this.config.apiEndpoint),
      () => this.prisma.isHealthy('database'),
      this.createRedisCheck(),
    ]);
  }

  async getDetailedHealthCheck(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.prisma.isHealthy('database'),
      () => this.memory.checkHeap('memory_heap', this.config.memoryThreshold),
      this.createRedisCheck(),
    ]);
  }

  private createRedisCheck(): HealthIndicatorFunction {
    return async () => {
      const startTime = Date.now();

      try {
        await this.redis.ping();
        return {
          redis: {
            status: 'up',
            responseTime: `${Date.now() - startTime}ms`,
            timestamp: new Date().toISOString(),
          },
        };
      } catch (error) {
        return {
          redis: {
            status: 'down',
            error: error instanceof Error ? error.message : 'Redis ping failed',
            timestamp: new Date().toISOString(),
            responseTime: `${Date.now() - startTime}ms`,
          },
        };
      }
    };
  }
}
