import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthController } from './health.controller';
import { RedisModule } from '../redis/redis.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MemoryHealthIndicator } from '@nestjs/terminus';
import { PrismaHealthIndicator } from './prisma.health';
import { HealthService } from './health.service';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TerminusModule,
    HttpModule,
    RedisModule,
    PrismaModule,
    ConfigModule,
    ScheduleModule.forRoot(),
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
  exports: [HealthService],
})
export class HealthModule {}
