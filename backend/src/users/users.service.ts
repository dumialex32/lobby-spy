import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';
import { UserWithLobbyRelations } from './types/user.types';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findBySteamId(steamId: string): Promise<UserWithLobbyRelations | null> {
    return this.prisma.user.findUnique({
      where: { steamId },
      include: {
        lobby: true,
        memberLobby: true,
      },
    });
  }

  async createUser(data: {
    steamId: string;
    username?: string;
    avatar?: string;
  }): Promise<User> {
    return await this.prisma.user.create({
      data,
    });
  }
}
