import { Module, forwardRef } from '@nestjs/common';
import { LobbyController } from './lobby.controller';
import { LobbyService } from './lobby.service';
import { LobbyGateway } from './lobby.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [LobbyController],
  providers: [
    LobbyService,
    LobbyGateway,
    PrismaService,
    UsersService,
    JwtService,
    ConfigService,
  ],
  exports: [LobbyGateway, LobbyService],
})
export class LobbyModule {}
