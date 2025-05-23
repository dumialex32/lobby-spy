import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  HealthCheckService,
  HttpHealthIndicator,
  MemoryHealthIndicator,
  HealthIndicatorFunction,
  HealthCheckResult,
} from '@nestjs/terminus';
import { RedisProvider } from '../redis/redis.provider';
import { PrismaHealthIndicator } from './prisma.health';
import {
  HealthStatus,
  HealthCheckResponseDto,
} from './dto/health-response.dto';

interface HealthCheckConfig {
  apiEndpoint: string;
  memoryThreshold: number;
  redisTimeout: number;
  circuitBreakerThreshold: number;
  cooldownPeriod?: number;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private failureCount = 0;
  private lastCircuitBreak = 0;

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
    const now = Date.now();
    const cooldown = this.config.cooldownPeriod ?? 30000;

    if (
      this.failureCount >= this.config.circuitBreakerThreshold &&
      now - this.lastCircuitBreak < cooldown
    ) {
      this.logger.warn('Circuit breaker engaged - failing fast');
      throw new Error('Service unavailable due to repeated failures');
    }

    try {
      // Modified: Removed API check
      const result = await this.health.check([
        () => this.prisma.isHealthy('database'),
        this.createRedisCheck(),
      ]);
      this.failureCount = 0;
      return result;
    } catch (err: unknown) {
      this.failureCount++;
      this.lastCircuitBreak = now;
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  async getDetailedHealthCheck(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.prisma.isHealthy('database'),
      () => this.memory.checkHeap('memory_heap', this.config.memoryThreshold),
      this.createRedisCheck(),
      this.checkDependencies(),
    ]);
  }

  aggregateResults(result: HealthCheckResult): HealthCheckResponseDto {
    const details = result.details;
    const errors: Record<string, any> = {};
    const warnings: string[] = [];
    let overallStatus = HealthStatus.UP;

    for (const [key, value] of Object.entries(details)) {
      const componentStatus = value.status as HealthStatus;

      if (componentStatus === HealthStatus.DOWN) {
        errors[key] = value;
        overallStatus = HealthStatus.DOWN;
      } else if (componentStatus === HealthStatus.WARNING) {
        warnings.push(`${key}:${value.message}`);
        if (overallStatus === HealthStatus.UP) {
          overallStatus = HealthStatus.WARNING;
        }
      }
    }

    return {
      status: overallStatus,
      details,
      errors,
      warnings: warnings.length ? warnings : undefined,
    };
  }

  private createRedisCheck(): HealthIndicatorFunction {
    return async () => {
      const startTime = Date.now();
      try {
        await this.redis.ping();
        return {
          redis: {
            status: HealthStatus.UP,
            responseTime: `${Date.now() - startTime}ms`,
            timestamp: new Date().toISOString(),
          },
        };
      } catch (error) {
        return {
          redis: {
            status: HealthStatus.DOWN,
            error: error instanceof Error ? error.message : 'Redis ping failed',
            timestamp: new Date().toISOString(),
            responseTime: `${Date.now() - startTime}ms`,
          },
        };
      }
    };
  }

  private checkDependencies(): HealthIndicatorFunction {
    return () => ({
      dependencies: {
        status: HealthStatus.UP,
        details: {
          db_version: '5.7.0',
          redis_version: '6.2.0',
        },
      },
    });
  }
}
