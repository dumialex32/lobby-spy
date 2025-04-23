import { Module } from '@nestjs/common';
import { LobbyController } from './lobby.controller';
import { LobbyService } from './lobby.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [LobbyController],
  providers: [LobbyService, PrismaService],
})
export class LobbyModule {}
