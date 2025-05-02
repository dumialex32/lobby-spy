import { Injectable, Logger } from '@nestjs/common';
import { HealthIndicatorResult } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';
import { HealthStatus } from './dto/health-response.dto';

/**
 * Database health indicator
 * @service
 * @description Monitors database connectivity with cooldown period
 */
@Injectable()
export class PrismaHealthIndicator {
  private readonly logger = new Logger(PrismaHealthIndicator.name);
  private lastFailure: number = 0;
  private readonly cooldown = 30000; // 30 seconds

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Checks database health status
   * @param {string} key - Component identifier
   * @returns {Promise<HealthIndicatorResult>} Database health status
   */
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    if (Date.now() - this.lastFailure < this.cooldown) {
      this.logger.warn('Database check skipped - in cooldown period');
      return {
        [key]: {
          status: HealthStatus.DOWN,
          error: 'In cooldown after recent failure',
          timestamp: new Date().toISOString(),
        },
      };
    }

    const startTime = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - startTime;

      return {
        [key]: {
          status: HealthStatus.UP,
          responseTime: `${responseTime}ms`,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: unknown) {
      this.lastFailure = Date.now();
      return {
        [key]: {
          status: HealthStatus.DOWN,
          error: error instanceof Error ? error.message : 'Prisma check failed',
          timestamp: new Date().toISOString(),
          responseTime: `${Date.now() - startTime}ms`,
        },
      };
    }
  }
}
