import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findBySteamId(steamId: string): Promise<User | null> {
    return await this.prisma.user.findUnique({
      where: { steamId },
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
