import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateLobbyDto } from './dto/create-lobby.dto';
import { LobbyVisibility } from '@prisma/client';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class LobbyService {
  constructor(
    private prismaService: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  // Create lobby service
  async createLobby(dto: CreateLobbyDto, steamId: string) {
    // Check if there is a lobby whose owner is the user with this steam id
    const existingLobby = await this.prismaService.lobby.findFirst({
      where: {
        owner: { steamId },
      },
    });

    if (existingLobby) {
      throw new BadRequestException('You already own a lobby');
    }

    // Create new lobby
    const user = await this.usersService.getUserOrThrow(steamId);

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const newLobby = await this.prismaService.lobby.create({
      data: {
        name: dto.name,
        visibility: dto.visibility || LobbyVisibility.PUBLIC,
        imageUrl: dto.description,
        description: dto.description,
        owner: { connect: { steamId } },
        members: { connect: { steamId } },
      },
      include: {
        owner: true,
        members: true,
      },
    });

    // Update user to owner and link lobby
    await this.prismaService.user.update({
      where: {
        steamId,
      },
      data: {
        role: 'OWNER',
        lobbyId: newLobby.id,
      },
    });

    return newLobby;
  }

  // Join lobby service
  async joinLobby(lobbyId: string, steamId: string) {
    // Check if lobby exist
    const lobby = await this.prismaService.lobby.findUnique({
      where: {
        id: lobbyId,
      },
    });

    if (!lobby) {
      throw new BadRequestException('Lobby not found');
    }

    // Check if user exist
    const user = await this.usersService.getUserOrThrow(steamId);

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Check if user is already member or owner
    if (user.lobbyId) {
      throw new BadRequestException('You already belong to or own a lobby');
    }

    // Get lobby members count
    const members = await this.prismaService.user.count({
      where: { lobbyId },
    });

    // Check for lobby size
    if (members >= lobby.capacity) {
      throw new BadRequestException('This lobby is full');
    }

    await this.prismaService.user.update({
      where: {
        steamId,
      },
      data: {
        lobbyId,
      },
    });

    return { message: 'Successfully joined the lobby' };
  }

  // Get personal lobby service
  async getMyLobby(steamId: string) {
    // Get user
    const user = await this.usersService.getUserOrThrow(steamId);

    // Check if user is part of a lobby
    if (!user?.lobby && !user?.memberLobby) {
      throw new NotFoundException('You are not part of a lobby');
    }

    return user.lobby || user.memberLobby;
  }

  // Get lobby service
  async getLobby(lobbyId: string, steamId: string) {
    const lobby = await this.prismaService.lobby.findUnique({
      where: { id: lobbyId },
      include: {
        owner: true,
        members: true,
      },
    });

    if (!lobby) {
      throw new NotFoundException('Lobby not found');
    }

    if (lobby.visibility === 'PRIVATE') {
      const isOwner = lobby.owner.steamId === steamId;
      const isMember = lobby.members.some(
        (member) => member.steamId === steamId,
      );
      const isLobbyMember = isOwner || isMember;

      if (!isLobbyMember) {
        throw new ForbiddenException(
          'Only members can access this private lobby',
        );
      }
    }

    return lobby;
  }

  // Update lobby visibility service
  async updateLobbyVisibility(
    lobbyId: string,
    steamId: string,
    visibility: 'PRIVATE' | 'PUBLIC',
  ) {
    // Get lobby
    const lobby = await this.prismaService.lobby.findUnique({
      where: {
        id: lobbyId,
      },
    });

    if (!lobby) {
      throw new NotFoundException('Lobby not found');
    }

    // Get user
    const user = await this.usersService.getUserOrThrow(steamId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if the user is the owner of the lobby
    if (lobby.ownerId !== user.steamId) {
      throw new ForbiddenException(
        'Only the owner can change the lobby visibility',
      );
    }

    // Change lobby visibility
    const updatedLobby = await this.prismaService.lobby.update({
      where: {
        id: lobbyId,
      },
      data: { visibility },
    });

    return updatedLobby;
  }
}
