import { Controller, Get } from '@nestjs/common';
import { HealthCheck } from '@nestjs/terminus';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { HealthCheckResponseDto } from './dto/health-response.dto';

/**
 * Health Check Controller
 * @description Exposes endpoints for system health monitoring
 * @class {HealthController}
 * @public
 */
@Controller('health')
@ApiTags('System Health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Basic health check endpoint
   * @description Verifies essential services (API, Database, Redis)
   * @returns {Promise<HealthCheckResponseDto>} Health status
   * @public
   */
  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Basic Health Check',
    description: 'Verifies essential services (API, Database, Redis)',
  })
  @ApiResponse({
    status: 200,
    description: 'System is operational',
    type: HealthCheckResponseDto,
  })
  @ApiResponse({
    status: 503,
    description: 'Service unavailable - critical components down',
  })
  async check(): Promise<HealthCheckResponseDto> {
    const result = await this.healthService.getHealthCheck();
    return this.healthService.aggregateResults(result);
  }

  /**
   * Detailed system check endpoint
   * @description Comprehensive health check including system resources
   * @returns {Promise<HealthCheckResponseDto>} Detailed health status
   * @public
   */
  @Get('detailed')
  @HealthCheck()
  @ApiOperation({
    summary: 'Detailed System Check',
    description: 'Comprehensive health check including system resources',
  })
  @ApiResponse({
    status: 200,
    description: 'Detailed system status',
    type: HealthCheckResponseDto,
  })
  async detailedCheck(): Promise<HealthCheckResponseDto> {
    const result = await this.healthService.getDetailedHealthCheck();
    return this.healthService.aggregateResults(result);
  }
}
