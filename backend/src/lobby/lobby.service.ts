import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateLobbyDto } from './dto/create-lobby.dto';
import { LobbyVisibility, UserRole } from '@prisma/client';
import { UsersService } from 'src/users/users.service';
import { UserWithLobbyRelations } from 'src/users/types/user.types';
import { LobbyGateway } from './lobby.gateway';

/**
 * Service responsible for managing lobby-related operations including
 * creation, join requests, visibility updates, and real-time notifications.
 */
@Injectable()
export class LobbyService {
  private readonly logger = new Logger(LobbyService.name);

  constructor(
    private prismaService: PrismaService,
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => LobbyGateway))
    private readonly lobbyGateway: LobbyGateway,
  ) {}

  /**
   * Handles and logs unexpected service-level errors.
   * @param error The caught exception.
   * @param context A string indicating which method triggered the error.
   * @throws BadRequestException for unexpected errors.
   */
  private handleServiceError(error: unknown, context: string): never {
    if (
      error instanceof NotFoundException ||
      error instanceof ForbiddenException ||
      error instanceof BadRequestException
    ) {
      throw error;
    }

    this.logger.error(
      `Unexpected error during "${context}": ${
        error instanceof Error ? error.stack : String(error)
      }`,
    );

    throw new BadRequestException(
      `An unexpected error occurred while trying to ${context}. Please try again later.`,
    );
  }

  /**
   * Retrieves a lobby by its ID, including owner and members.
   * @param lobbyId The ID of the lobby.
   * @returns The lobby object.
   * @throws NotFoundException if the lobby doesn't exist.
   */
  private async getLobbyById(lobbyId: string) {
    try {
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

      return lobby;
    } catch (error) {
      this.handleServiceError(error, 'retrieve lobby');
    }
  }

  /**
   * Creates a new lobby and assigns the user as owner and member.
   * @param dto Lobby creation details.
   * @param user The authenticated user creating the lobby.
   * @returns The newly created lobby.
   * @throws ForbiddenException if the user is already in a lobby.
   */
  async createLobby(dto: CreateLobbyDto, user: UserWithLobbyRelations) {
    if (user.memberLobby) {
      throw new ForbiddenException(
        'You are already a member or an owner of a lobby',
      );
    }

    try {
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
        void this.lobbyGateway.notifyNewMember(
          newLobby.id,
          user.id,
          user.username || 'Anonymous',
        );
      }

      return newLobby;
    } catch (error) {
      this.handleServiceError(error, 'create lobby');
    }
  }

  /**
   * Creates a join request for a lobby.
   * @param lobbyId The target lobby's ID.
   * @param user The user sending the join request.
   * @returns A confirmation message.
   * @throws BadRequestException if the user already requested to join.
   */
  async createJoinRequest(lobbyId: string, user: UserWithLobbyRelations) {
    try {
      const existingAnyRequest =
        await this.prismaService.lobbyJoinRequest.findFirst({
          where: { userId: user.id },
        });

      if (existingAnyRequest) {
        throw new BadRequestException(
          'You already have a pending request to another lobby',
        );
      }

      const lobby = await this.getLobbyById(lobbyId);

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

      await this.prismaService.lobbyJoinRequest.create({
        data: {
          userId: user.id,
          lobbyId: lobby.id,
        },
      });

      if (this.lobbyGateway.isUserConnected(lobby.ownerId)) {
        void this.lobbyGateway.notifyNewRequest(
          lobby.id,
          user.id,
          user.username || 'Anonymous',
        );
      }

      return {
        message: 'Your join request has been sent and is pending approval.',
      };
    } catch (error) {
      this.handleServiceError(error, 'create join request');
    }
  }

  /**
   * Cancels a user's pending join request.
   * @param lobbyId The ID of the lobby.
   * @param user The user cancelling their request.
   * @returns A confirmation message.
   */
  async cancelJoinRequest(lobbyId: string, user: UserWithLobbyRelations) {
    try {
      const lobby = await this.getLobbyById(lobbyId);

      await this.prismaService.lobbyJoinRequest.delete({
        where: {
          userId_lobbyId: {
            userId: user.id,
            lobbyId: lobby.id,
          },
        },
      });

      if (this.lobbyGateway.isUserConnected(lobby.ownerId)) {
        void this.lobbyGateway.notifyRequestCancelled(lobby.id, user.id);
      }

      return { message: 'Join request has been cancelled' };
    } catch (error) {
      this.handleServiceError(error, 'cancel join request');
    }
  }

  /**
   * Approves a pending join request.
   * @param lobbyId The lobby ID.
   * @param userId The user to approve.
   * @param owner The lobby owner performing the approval.
   * @returns A success message.
   */
  async approveJoinRequest(
    lobbyId: string,
    userId: string,
    owner: UserWithLobbyRelations,
  ) {
    try {
      const lobby = await this.getLobbyById(lobbyId);

      if (lobby.ownerId !== owner.id) {
        throw new ForbiddenException(
          'Only the owner can approve join requests',
        );
      }

      if (lobby.members.length >= lobby.capacity) {
        throw new BadRequestException('Lobby has reached maximum capacity');
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
        void this.lobbyGateway.notifyUserRequestUpdate(
          userId,
          lobbyId,
          'accepted',
        );
        void this.lobbyGateway.notifyNewMember(
          lobbyId,
          userId,
          user.username || 'Anonymous',
        );
      }

      return { message: 'User has been added to the lobby' };
    } catch (error) {
      this.handleServiceError(error, 'approve join request');
    }
  }

  /**
   * Rejects a join request to the lobby.
   * @param lobbyId The lobby ID.
   * @param userId The user whose request is rejected.
   * @param owner The lobby owner performing the rejection.
   * @returns A success message.
   */
  async rejectJoinRequest(
    lobbyId: string,
    userId: string,
    owner: UserWithLobbyRelations,
  ) {
    try {
      const lobby = await this.getLobbyById(lobbyId);

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
        void this.lobbyGateway.notifyUserRequestUpdate(
          userId,
          lobbyId,
          'rejected',
        );
      }

      return { message: 'Join request has been rejected' };
    } catch (error) {
      this.handleServiceError(error, 'reject join request');
    }
  }

  /**
   * Retrieves all pending join requests for a lobby.
   * @param lobbyId The lobby ID.
   * @param user The lobby owner.
   * @returns List of join requests with user info.
   */
  async getPendingRequests(lobbyId: string, user: UserWithLobbyRelations) {
    try {
      const lobby = await this.getLobbyById(lobbyId);

      if (lobby.ownerId !== user.id) {
        throw new ForbiddenException(
          'Only the owner can view pending requests',
        );
      }

      return this.prismaService.lobbyJoinRequest.findMany({
        where: { lobbyId },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatar: true,
              steamId: true,
            },
          },
        },
      });
    } catch (error) {
      this.handleServiceError(error, 'retrieve pending requests');
    }
  }

  /**
   * Retrieves the lobby that the user is a member of.
   * @param user The current user.
   * @returns The user's lobby.
   */
  async getMyLobby(user: UserWithLobbyRelations) {
    try {
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

      if (!lobby) {
        throw new NotFoundException('Lobby not found');
      }

      return lobby;
    } catch (error) {
      this.handleServiceError(error, 'retrieve your lobby');
    }
  }

  /**
   * Retrieves details about a specific lobby based on visibility and membership.
   * @param lobbyId The ID of the lobby.
   * @param user The requesting user.
   * @returns The lobby object.
   */
  async getLobby(lobbyId: string, user: UserWithLobbyRelations) {
    try {
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

      if (lobby.visibility === 'PRIVATE' && user.memberLobby?.id !== lobbyId) {
        throw new ForbiddenException(
          'Only members can access this private lobby',
        );
      }

      return lobby;
    } catch (error) {
      this.handleServiceError(error, 'retrieve lobby');
    }
  }

  /**
   * Updates the visibility status of a lobby.
   * @param id The lobby ID.
   * @param user The lobby owner.
   * @param visibility New visibility status.
   * @returns The updated lobby object.
   */
  async updateLobbyVisibility(
    id: string,
    user: UserWithLobbyRelations,
    visibility: LobbyVisibility,
  ) {
    try {
      const lobby = await this.prismaService.lobby.findUnique({
        where: { id },
      });

      if (!lobby) {
        throw new NotFoundException('Lobby not found');
      }

      if (lobby.ownerId !== user.id) {
        throw new ForbiddenException('Only the owner can update visibility');
      }

      const updatedLobby = await this.prismaService.lobby.update({
        where: { id },
        data: { visibility },
      });

      void this.lobbyGateway.notifyVisibilityChange(
        updatedLobby.id,
        updatedLobby.visibility,
      );

      return updatedLobby;
    } catch (error) {
      this.handleServiceError(error, 'update lobby visibility');
    }
  }

  /**
   * Allows a user to leave their current lobby.
   * @param user The user leaving the lobby.
   * @returns A confirmation message.
   */
  async leaveLobby(user: UserWithLobbyRelations) {
    try {
      if (!user.memberLobby) {
        throw new BadRequestException('You are not part of any lobby');
      }

      const lobbyId = user.memberLobby.id;

      await this.prismaService.user.update({
        where: { id: user.id },
        data: {
          lobbyId: null,
          role: UserRole.MEMBER,
        },
      });

      if (this.lobbyGateway.isUserConnected(user.id)) {
        void this.lobbyGateway.notifyMemberLeft(
          lobbyId,
          user.id,
          user.username || 'Anonymous',
        );
      }

      return { message: 'You have left the lobby' };
    } catch (error) {
      this.handleServiceError(error, 'leave lobby');
    }
  }

  /**
   * Removes a member from a lobby.
   * @param lobbyId The lobby ID.
   * @param memberId The member to remove.
   * @param owner The lobby owner performing the removal.
   * @returns A confirmation message.
   */
  async removeMember(
    lobbyId: string,
    memberId: string,
    owner: UserWithLobbyRelations,
  ) {
    try {
      const lobby = await this.getLobbyById(lobbyId);

      if (lobby.ownerId !== owner.id) {
        throw new ForbiddenException('Only the owner can remove members');
      }

      if (memberId === owner.id) {
        throw new BadRequestException('Owner cannot remove themselves');
      }

      const user = await this.prismaService.user.findUnique({
        where: { id: memberId },
      });

      if (!user || user.lobbyId !== lobbyId) {
        throw new BadRequestException('User is not a member of this lobby');
      }

      await this.prismaService.user.update({
        where: { id: memberId },
        data: {
          lobbyId: null,
          role: UserRole.MEMBER,
        },
      });

      if (this.lobbyGateway.isUserConnected(memberId)) {
        void this.lobbyGateway.notifyUserRequestUpdate(
          memberId,
          lobbyId,
          'kicked',
        );
      }

      return { message: 'Member has been removed from the lobby' };
    } catch (error) {
      this.handleServiceError(error, 'remove member');
    }
  }
}
