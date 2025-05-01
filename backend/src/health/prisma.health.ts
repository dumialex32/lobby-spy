import { Injectable } from '@nestjs/common';
import { HealthIndicatorResult } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaHealthIndicator {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Checks database health using Prisma
   * @param key - Health check key name
   * @returns HealthIndicatorResult with status and timing information
   */
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - startTime;

      return {
        [key]: {
          status: 'up',
          responseTime: `${responseTime}ms`,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: unknown) {
      return {
        [key]: {
          status: 'down',
          error: error instanceof Error ? error.message : 'Prisma check failed',
          timestamp: new Date().toISOString(),
          responseTime: `${Date.now() - startTime}ms`,
        },
      };
    }
  }
}
