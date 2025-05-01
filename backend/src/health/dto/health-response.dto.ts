import { ApiProperty } from '@nestjs/swagger';

export class HealthCheckResponseDto {
  @ApiProperty({ example: 'up', description: 'Overall status' })
  status: string;

  @ApiProperty({
    example: {
      api: { status: 'up', responseTime: '32ms' },
      database: { status: 'up', responseTime: '45ms' },
    },
    description: 'Details of each service',
  })
  details: Record<string, any>;

  @ApiProperty({
    example: {},
    description: 'Error information if any service is down',
  })
  error: Record<string, any>;
}
