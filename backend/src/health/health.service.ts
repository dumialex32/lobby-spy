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
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private failureCount = 0;

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
    if (this.failureCount >= this.config.circuitBreakerThreshold) {
      this.logger.warn('Circuit breaker engaged - failing fast');
      throw new Error('Service unavailable due to repeated failures');
    }

    try {
      const result = await this.health.check([
        () => this.http.pingCheck('api', this.config.apiEndpoint),
        () => this.prisma.isHealthy('database'),
        this.createRedisCheck(),
      ]);
      this.failureCount = 0; // Reset on success
      return result;
    } catch (err) {
      this.failureCount++;
      throw err;
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
      const componentStatus = value.status as HealthStatus; // Type assertion

      if (componentStatus === HealthStatus.DOWN) {
        errors[key] = value;
        overallStatus = HealthStatus.DOWN;
      } else if (componentStatus === HealthStatus.WARNING) {
        warnings.push(`${key}:${value.message}`);
        // Only downgrade to WARNING if currently UP
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
    return () => {
      // Example: Check if database version matches expected
      return {
        dependencies: {
          status: HealthStatus.UP,
          details: {
            db_version: '5.7.0',
            redis_version: '6.2.0',
          },
        },
      };
    };
  }
}
