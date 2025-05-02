import { ApiProperty } from '@nestjs/swagger';

/**
 * System health status values
 * @enum {HealthStatus}
 */
export enum HealthStatus {
  /**
   * System is healthy and functioning normally
   */
  UP = 'up',

  /**
   * Critical failure affecting system functionality
   */
  DOWN = 'down',

  /**
   * Non-critical issues that may affect performance
   */
  WARNING = 'warning',
}

/**
 * Standardized health check response format
 * @class {HealthCheckResponseDto}
 */
export class HealthCheckResponseDto {
  /**
   * Aggregated system status
   * @example HealthStatus.UP
   */
  @ApiProperty({
    enum: HealthStatus,
    example: HealthStatus.UP,
    description: 'Aggregated system status (UP/DOWN/WARNING)',
  })
  status: HealthStatus;

  /**
   * Detailed status of each monitored component
   * @example { database: { status: HealthStatus.UP, responseTime: '45ms' } }
   */
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

  /**
   * Error details for failed components
   * @example { redis: { status: HealthStatus.DOWN, error: 'Connection timeout' } }
   */
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

  /**
   * Non-critical warning messages
   * @example ['database:version_mismatch']
   */
  @ApiProperty({
    description: 'Non-critical warning messages',
    required: false,
    example: ['database:version_mismatch'],
  })
  warnings?: string[];
}
