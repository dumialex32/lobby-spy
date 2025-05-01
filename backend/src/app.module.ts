import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ReplayModule } from './replay/replay.module';
import { LobbyModule } from './lobby/lobby.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { RedisThrottlerStorage } from './throttler/redis-throttler.storage';
import { RedisModule } from './redis/redis.module';
import { throttlerConfig } from './throttler/throttler.config';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
    }),
    RedisModule,
    ThrottlerModule.forRootAsync({
      imports: [RedisModule, ConfigModule],
      inject: [RedisThrottlerStorage, ConfigService],
      useFactory: throttlerConfig,
    }),
    AuthModule,
    UsersModule,
    ReplayModule,
    LobbyModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
