import { Controller, Get } from '@nestjs/common';
import { HealthCheck } from '@nestjs/terminus';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { HealthCheckResponseDto } from './dto/health-response.dto'; // Removed HealthStatus import

@Controller('health')
@ApiTags('System Health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Basic Health Check',
    description: 'Checks essential services (API, Database, Redis)',
  })
  @ApiResponse({
    status: 200,
    description: 'Health status with basic service checks',
    type: HealthCheckResponseDto,
  })
  @ApiResponse({
    status: 503,
    description: 'Service unavailable when critical components are down',
  })
  async check(): Promise<HealthCheckResponseDto> {
    const result = await this.healthService.getHealthCheck();
    return this.healthService.aggregateResults(result);
  }

  @Get('detailed')
  @HealthCheck()
  @ApiOperation({
    summary: 'Detailed System Check',
    description: 'Comprehensive health check including system resources',
  })
  @ApiResponse({
    status: 200,
    description: 'Detailed system health status',
    type: HealthCheckResponseDto,
  })
  async detailedCheck(): Promise<HealthCheckResponseDto> {
    const result = await this.healthService.getDetailedHealthCheck();
    return this.healthService.aggregateResults(result);
  }
}
