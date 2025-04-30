import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateLobbyDto } from './dto/create-lobby.dto';
import { LobbyVisibility } from '@prisma/client';
import { UsersService } from 'src/users/users.service';
import { UserWithLobbyRelations } from 'src/users/types/user.types';
import { LobbyGateway } from './lobby.gateway';

@Injectable()
export class LobbyService {
  constructor(
    private prismaService: PrismaService,
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => LobbyGateway))
    private readonly lobbyGateway: LobbyGateway,
  ) {}

  async createLobby(dto: CreateLobbyDto, user: UserWithLobbyRelations) {
    if (user.memberLobby) {
      throw new ForbiddenException(
        'You are already a member or an owner of a lobby',
      );
    }

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

    await this.prismaService.user.update({
      where: { id: user.id },
      data: {
        role: 'OWNER',
        lobby: { connect: { id: newLobby.id } },
        lobbyId: newLobby.id,
      },
    });

    if (this.lobbyGateway.isUserConnected(user.id)) {
      this.lobbyGateway.notifyNewMember(
        newLobby.id,
        user.id,
        user.username || 'Anonymous',
      );
    }

    return newLobby;
  }

  async createJoinRequest(lobbyId: string, user: UserWithLobbyRelations) {
    const lobby = await this.prismaService.lobby.findUnique({
      where: { id: lobbyId },
    });

    if (!lobby) {
      throw new NotFoundException('Lobby not found');
    }

    if (user.memberLobby) {
      throw new BadRequestException('You are already a member of a lobby');
    }

    const existingRequest =
      await this.prismaService.lobbyJoinRequest.findUnique({
        where: {
          userId_lobbyId: {
            userId: user.id,
            lobbyId: lobby.id,
          },
        },
      });

    if (existingRequest) {
      throw new BadRequestException(
        'You have already sent a request to join this lobby',
      );
    }

    // Remove the unused request variable assignment
    await this.prismaService.lobbyJoinRequest.create({
      data: {
        userId: user.id,
        lobbyId: lobby.id,
      },
    });

    if (this.lobbyGateway.isUserConnected(lobby.ownerId)) {
      this.lobbyGateway.notifyNewRequest(
        lobby.id,
        user.id,
        user.username || 'Anonymous',
      );
    }

    return {
      message: 'Your join request has been sent and is pending approval.',
    };
  }

  async approveJoinRequest(
    lobbyId: string,
    userId: string,
    owner: UserWithLobbyRelations,
  ) {
    const lobby = await this.prismaService.lobby.findUnique({
      where: { id: lobbyId },
    });

    if (!lobby) {
      throw new NotFoundException('Lobby not found');
    }

    if (lobby.ownerId !== owner.id) {
      throw new ForbiddenException('Only the owner can approve join requests');
    }

    const request = await this.prismaService.lobbyJoinRequest.findUnique({
      where: {
        userId_lobbyId: {
          userId,
          lobbyId,
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Join request not found');
    }

    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.lobbyId) {
      throw new BadRequestException('User is already in a lobby');
    }

    await this.prismaService.$transaction([
      this.prismaService.user.update({
        where: { id: userId },
        data: { lobbyId },
      }),
      this.prismaService.lobbyJoinRequest.delete({
        where: {
          userId_lobbyId: {
            userId,
            lobbyId,
          },
        },
      }),
    ]);

    if (this.lobbyGateway.isUserConnected(userId)) {
      this.lobbyGateway.notifyUserRequestUpdate(userId, lobbyId, 'accepted');
      this.lobbyGateway.notifyNewMember(
        lobbyId,
        userId,
        user.username || 'Anonymous',
      );
    }

    return { message: 'User has been added to the lobby' };
  }

  async rejectJoinRequest(
    lobbyId: string,
    userId: string,
    owner: UserWithLobbyRelations,
  ) {
    const lobby = await this.prismaService.lobby.findUnique({
      where: { id: lobbyId },
    });

    if (!lobby) {
      throw new NotFoundException('Lobby not found');
    }

    if (lobby.ownerId !== owner.id) {
      throw new ForbiddenException('Only the owner can reject join requests');
    }

    const request = await this.prismaService.lobbyJoinRequest.findUnique({
      where: {
        userId_lobbyId: {
          userId,
          lobbyId,
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Join request not found');
    }

    await this.prismaService.lobbyJoinRequest.delete({
      where: {
        userId_lobbyId: {
          userId,
          lobbyId,
        },
      },
    });

    if (this.lobbyGateway.isUserConnected(userId)) {
      this.lobbyGateway.notifyUserRequestUpdate(userId, lobbyId, 'rejected');
    }

    return { message: 'Join request has been rejected' };
  }

  async getMyLobby(user: UserWithLobbyRelations) {
    if (!user.memberLobby) {
      throw new NotFoundException('You are not part of a lobby');
    }

    const lobby = await this.prismaService.lobby.findUnique({
      where: { id: user.memberLobby.id },
      include: {
        members: true,
        owner: true,
        games: true,
      },
    });

    return lobby;
  }

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

  async updateLobbyVisibility(
    lobbyId: string,
    user: UserWithLobbyRelations,
    visibility: 'PRIVATE' | 'PUBLIC',
  ) {
    const lobby = await this.prismaService.lobby.findUnique({
      where: { id: lobbyId },
    });

    if (!lobby) {
      throw new NotFoundException('Lobby not found');
    }

    if (lobby.ownerId !== user.id) {
      throw new ForbiddenException(
        'Only the owner can change the lobby visibility',
      );
    }

    const updatedLobby = await this.prismaService.lobby.update({
      where: { id: lobbyId },
      data: { visibility },
    });

    this.lobbyGateway.notifyVisibilityChange(lobbyId, visibility);

    return updatedLobby;
  }

  async leaveLobby(user: UserWithLobbyRelations) {
    if (!user.memberLobby) {
      throw new BadRequestException('You are not part of any lobby');
    }

    const lobbyId = user.memberLobby.id;

    await this.prismaService.user.update({
      where: { id: user.id },
      data: { lobbyId: null },
    });

    this.lobbyGateway.notifyMemberLeft(
      lobbyId,
      user.id,
      user.username || 'Anonymous',
    );

    return { message: 'You have left the lobby' };
  }

  async kickMember(
    lobbyId: string,
    userId: string,
    owner: UserWithLobbyRelations,
  ) {
    const lobby = await this.prismaService.lobby.findUnique({
      where: { id: lobbyId },
    });

    if (!lobby) {
      throw new NotFoundException('Lobby not found');
    }

    if (lobby.ownerId !== owner.id) {
      throw new ForbiddenException('Only the owner can kick members');
    }

    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      include: { memberLobby: true },
    });

    if (!user || user.memberLobby?.id !== lobbyId) {
      throw new BadRequestException('User is not a member of this lobby');
    }

    if (user.id === owner.id) {
      throw new BadRequestException('You cannot kick yourself as the owner');
    }

    await this.prismaService.user.update({
      where: { id: userId },
      data: { lobbyId: null },
    });

    if (this.lobbyGateway.isUserConnected(userId)) {
      this.lobbyGateway.notifyUserRequestUpdate(userId, lobbyId, 'kicked');
      this.lobbyGateway.notifyMemberLeft(
        lobbyId,
        userId,
        user.username || 'Anonymous',
      );
    }

    return { message: 'User has been removed from the lobby' };
  }
}
