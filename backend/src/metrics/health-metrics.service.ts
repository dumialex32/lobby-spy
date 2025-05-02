import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Gauge } from 'prom-client';
import { SchedulerRegistry } from '@nestjs/schedule';
import { HealthService } from '../health/health.service';
import { HealthStatus } from '../health/dto/health-response.dto';

interface HealthDetail {
  status: HealthStatus;
  responseTime?: string;
  message?: string;
}

/**
 * Health Metrics Service
 * @description Collects and exposes health metrics via Prometheus
 * @class {HealthMetricsService}
 * @public
 */
@Injectable()
export class HealthMetricsService implements OnModuleDestroy {
  private readonly logger = new Logger(HealthMetricsService.name);
  private healthGauge: Gauge<string>;
  private responseTimeGauge: Gauge<string>;
  private updateInterval?: NodeJS.Timeout;

  constructor(
    private readonly healthService: HealthService,
    private readonly scheduler: SchedulerRegistry,
  ) {
    this.initializeMetrics();
    this.setupMetricsCollection();
  }

  /**
   * Initializes Prometheus metrics
   * @private
   */
  private initializeMetrics(): void {
    this.healthGauge = new Gauge({
      name: 'app_health_status',
      help: 'Application health status (1 = UP, 0 = DOWN, 0.5 = WARNING)',
      labelNames: ['service'],
    });

    this.responseTimeGauge = new Gauge({
      name: 'app_health_response_time_ms',
      help: 'Health check response time in milliseconds',
      labelNames: ['service'],
    });
  }

  /**
   * Sets up periodic metrics collection
   * @private
   */
  private setupMetricsCollection(): void {
    this.updateInterval = setInterval(() => {
      this.updateMetricsWithRetry().catch((err: unknown) => {
        this.logger.error(
          'Failed to update metrics after retries',
          err instanceof Error ? err.stack : String(err),
        );
      });
    }, 30000);

    try {
      this.scheduler.addInterval('health-metrics', this.updateInterval);
    } catch (err) {
      this.logger.error('Failed to schedule metrics collection', err);
      if (this.updateInterval) clearInterval(this.updateInterval);
    }
  }

  /**
   * Updates metrics with retry logic
   * @param {number} retries - Number of retry attempts
   * @private
   */
  private async updateMetricsWithRetry(retries = 3): Promise<void> {
    try {
      await this.updateMetrics();
    } catch (err) {
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return this.updateMetricsWithRetry(retries - 1);
      }
      throw err;
    }
  }

  /**
   * Updates all health metrics
   * @public
   */
  async updateMetrics(): Promise<void> {
    try {
      const health = await this.healthService.getHealthCheck();
      const result = this.healthService.aggregateResults(health);

      const statusValue = this.getStatusValue(result.status);
      this.healthGauge.set(statusValue);

      Object.entries(result.details).forEach(([service, detail]) => {
        const typedDetail = detail as HealthDetail;
        const serviceStatus = this.getStatusValue(typedDetail.status);

        this.healthGauge.set({ service }, serviceStatus);

        if (typedDetail.responseTime) {
          const time = this.parseResponseTime(typedDetail.responseTime);
          this.responseTimeGauge.set({ service }, time);
        }
      });
    } catch (error) {
      this.logger.error(
        'Error updating health metrics',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Converts health status to numeric value
   * @private
   */
  private getStatusValue(status: HealthStatus): number {
    return {
      [HealthStatus.UP]: 1,
      [HealthStatus.WARNING]: 0.5,
      [HealthStatus.DOWN]: 0,
    }[status];
  }

  /**
   * Parses response time string to milliseconds
   * @private
   */
  private parseResponseTime(responseTime: string): number {
    return parseInt(responseTime.replace('ms', ''), 10);
  }

  /**
   * Cleans up resources on module destruction
   * @public
   */
  onModuleDestroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    this.scheduler.deleteInterval('health-metrics');
  }
}
