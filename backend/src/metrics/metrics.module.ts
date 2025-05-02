import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HealthModule } from '../health/health.module';
import { HealthMetricsService } from './health-metrics.service';
import { MetricsController } from './metrics.controller';

@Module({
  imports: [
    PrometheusModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        defaultMetrics: {
          enabled: config.get('METRICS_ENABLED', true),
        },
        path: config.get('METRICS_PATH', '/metrics'),
        customMetrics: {
          prefix: 'app_',
        },
      }),
      inject: [ConfigService],
    }),
    HealthModule,
  ],
  controllers: [MetricsController],
  providers: [HealthMetricsService],
  exports: [PrometheusModule, HealthMetricsService],
})
export class MetricsModule {}
