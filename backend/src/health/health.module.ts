import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';
import { RedisModule } from '../redis/redis.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MemoryHealthIndicator } from '@nestjs/terminus';
import { PrismaHealthIndicator } from './prisma.health';
import { HealthService } from './health.service';
import { ConfigModule, ConfigService } from '@nestjs/config';

/**
 * Health check module configuration
 * @module
 * @description Configures health monitoring endpoints and dependencies
 */
@Module({
  imports: [
    TerminusModule,
    HttpModule,
    RedisModule,
    PrismaModule,
    ConfigModule,
  ],
  controllers: [HealthController],
  providers: [
    MemoryHealthIndicator,
    PrismaHealthIndicator,
    HealthService,
    {
      provide: 'HEALTH_CHECK_CONFIG',
      useFactory: (configService: ConfigService) => ({
        apiEndpoint: configService.get<string>(
          'HEALTH_API_ENDPOINT',
          'http://localhost:3000/api',
        ),
        memoryThreshold: configService.get<number>(
          'HEALTH_MEMORY_THRESHOLD',
          150 * 1024 * 1024,
        ),
      }),
      inject: [ConfigService],
    },
  ],
})
export class HealthModule {}
