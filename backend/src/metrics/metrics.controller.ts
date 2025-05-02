import { Controller, Get } from '@nestjs/common';
import { HealthMetricsService } from './health-metrics.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

/**
 * Metrics Controller
 * @description Exposes endpoints for accessing system metrics
 * @class MetricsController
 * @public
 *
 * @controller /metrics - Base route for all metrics endpoints
 *
 * @example
 * // Sample requests:
 * GET /metrics/health - Triggers health metrics update
 */
@Controller('metrics')
@ApiTags('System Metrics')
export class MetricsController {
  /**
   * Creates an instance of MetricsController
   * @param {HealthMetricsService} healthMetrics - Service for handling health metrics
   */
  constructor(private readonly healthMetrics: HealthMetricsService) {}

  /**
   * Health Metrics Endpoint
   * @description Triggers an update of health metrics and returns confirmation
   * @summary Update and retrieve health metrics
   * @returns {Promise<{message: string}>} Confirmation message
   *
   * @example
   * // Successful response:
   * {
   *   "message": "Health metrics updated"
   * }
   *
   * @throws {InternalServerErrorException} If metrics update fails
   * @public
   */
  @Get('health')
  @ApiOperation({
    summary: 'Get health metrics',
    description:
      'Triggers an update of system health metrics and returns confirmation',
  })
  @ApiResponse({
    status: 200,
    description: 'Health metrics successfully updated',
    schema: {
      type: 'object',
      example: { message: 'Health metrics updated' },
      properties: {
        message: {
          type: 'string',
          description: 'Confirmation message',
        },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error - Failed to update metrics',
  })
  async getHealthMetrics(): Promise<{ message: string }> {
    await this.healthMetrics.updateMetrics();
    return { message: 'Health metrics updated' };
  }
}
