import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckResult } from '@nestjs/terminus'; // Corrected import
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { HealthCheckResponseDto } from './dto/health-response.dto';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Basic service health check' })
  @ApiResponse({
    status: 200,
    description: 'Health status',
    type: HealthCheckResponseDto,
  })
  async check(): Promise<HealthCheckResult> {
    return this.healthService.getHealthCheck();
  }

  @Get('detailed')
  @HealthCheck()
  @ApiOperation({ summary: 'Detailed system health check' })
  @ApiResponse({
    status: 200,
    description: 'Detailed health status',
    type: HealthCheckResponseDto,
  })
  async detailedCheck(): Promise<HealthCheckResult> {
    return this.healthService.getDetailedHealthCheck();
  }
}
