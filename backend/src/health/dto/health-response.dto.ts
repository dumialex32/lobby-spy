import { ApiProperty } from '@nestjs/swagger';

/**
 * System health status values
 * @enum {string}
 * @property {string} UP - System is healthy
 * @property {string} DOWN - Critical failure detected
 * @property {string} WARNING - Non-critical issues present
 */
export enum HealthStatus {
  UP = 'up',
  DOWN = 'down',
  WARNING = 'warning',
}

/**
 * Health check response format
 * @class
 * @property {HealthStatus} status - Overall system status
 * @property {Record<string, any>} details - Component status details
 * @property {Record<string, any>} errors - Error information for failed components
 * @property {string[]} [warnings] - Optional warning messages
 */
export class HealthCheckResponseDto {
  @ApiProperty({
    enum: HealthStatus,
    example: HealthStatus.UP,
    description: 'Aggregated system status (UP/DOWN/WARNING)',
  })
  status: HealthStatus;

  @ApiProperty({
    description: 'Detailed status of each monitored component',
    example: {
      database: {
        status: HealthStatus.UP,
        responseTime: '45ms',
      },
    },
  })
  details: Record<string, any>;

  @ApiProperty({
    description: 'Error details for failed components',
    example: {
      redis: {
        status: HealthStatus.DOWN,
        error: 'Connection timeout',
      },
    },
  })
  errors: Record<string, any>;

  @ApiProperty({
    description: 'Non-critical warning messages',
    required: false,
    example: ['database:version_mismatch'],
  })
  warnings?: string[];
}
