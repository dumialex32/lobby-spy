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
import { UserWithLobbyRelations } from 'src/users/types/user.types';

@Injectable()
export class LobbyService {
  constructor(
    private prismaService: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  // Create lobby service
  async createLobby(dto: CreateLobbyDto, user: UserWithLobbyRelations) {
    // 2.Check if user is a lobby owner or a member
    // both, owner and members have "memberLobby" property
    if (user.memberLobby) {
      throw new ForbiddenException(
        'You are already a member or an owner of a lobby',
      );
    }

    // Create lobby
    const newLobby = await this.prismaService.lobby.create({
      data: {
        name: dto.name,
        visibility: dto.visibility || LobbyVisibility.PUBLIC,
        imageUrl: dto.imageUrl,
        description: dto.description,
        owner: { connect: { id: user.id } },
        members: { connect: { id: user.id } },
      },
      include: {
        owner: true,
        members: true,
      },
    });

    // Update user to owner and link lobby
    await this.prismaService.user.update({
      where: {
        id: user.id,
      },
      data: {
        role: 'OWNER',
        lobby: { connect: { id: newLobby.id } },
        lobbyId: newLobby.id,
      },
    });

    return newLobby;
  }

  // Join lobby service
  async joinLobby(lobbyId: string, user: UserWithLobbyRelations) {
    // Check if lobby exist
    const lobby = await this.prismaService.lobby.findUnique({
      where: {
        id: lobbyId,
      },
    });

    if (!lobby) {
      throw new NotFoundException('Lobby not found');
    }

    // Check if user is already member or owner
    if (user.memberLobby) {
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

    // Update the user
    await this.prismaService.user.update({
      where: {
        id: user.id,
      },
      data: {
        lobbyId,
      },
    });

    return { message: `Welcome to ${lobby.name}` };
  }

  // Get personal lobby service
  async getMyLobby(user: UserWithLobbyRelations) {
    // Check if user has a lobby
    if (!user.memberLobby) {
      throw new NotFoundException('You are not part of a lobby');
    }

    // Fetch lobby
    const lobby = await this.prismaService.lobby.findUnique({
      where: {
        id: user.memberLobby.id,
      },
      include: {
        members: true,
        owner: true,
        games: true,
      },
    });

    return lobby;
  }

  // Get lobby service
  async getLobby(lobbyId: string, user: UserWithLobbyRelations) {
    const lobby = await this.prismaService.lobby.findUnique({
      where: { id: lobbyId },
      include: {
        owner: true,
        members: true,
        games: true,
      },
    });

    if (!lobby) {
      throw new NotFoundException('Lobby not found');
    }

    if (lobby.visibility === 'PRIVATE') {
      if (user.memberLobby?.id !== lobbyId) {
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
    user: UserWithLobbyRelations,
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

    // Check if the user is the owner of the lobby
    if (lobby.ownerId !== user.id) {
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
