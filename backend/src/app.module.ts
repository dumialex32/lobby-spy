import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ReplayModule } from './replay/replay.module';
import { LobbyModule } from './lobby/lobby.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
    }),
    AuthModule,
    UsersModule,
    ReplayModule,
    LobbyModule,
  ],
})
export class AppModule {}
