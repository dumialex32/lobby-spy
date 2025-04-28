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

/**
 * Lobby Management Service
 *
 * Handles all core lobby business logic including:
 * - Lobby creation and configuration
 * - Member management and joining
 * - Visibility control
 * - Lobby information retrieval
 *
 * Integrates with:
 * - PrismaService for database operations
 * - UsersService for user management
 */
@Injectable()
export class LobbyService {
  constructor(
    private prismaService: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Creates a new lobby
   * @param dto - Lobby creation data (name, visibility, etc.)
   * @param user - The user creating the lobby
   * @returns The newly created lobby
   * @throws ForbiddenException if user already belongs to a lobby
   */
  async createLobby(dto: CreateLobbyDto, user: UserWithLobbyRelations) {
    // Verify user isn't already in a lobby (as member or owner)
    if (user.memberLobby) {
      throw new ForbiddenException(
        'You are already a member or an owner of a lobby',
      );
    }

    // Create new lobby in database
    const newLobby = await this.prismaService.lobby.create({
      data: {
        name: dto.name,
        visibility: dto.visibility || LobbyVisibility.PUBLIC, // Default to public
        imageUrl: dto.imageUrl,
        description: dto.description,
        owner: { connect: { id: user.id } }, // Set creator as owner
        members: { connect: { id: user.id } }, // Add creator as initial member
      },
      include: {
        owner: true,
        members: true,
      },
    });

    // Update user role to OWNER and link to lobby
    await this.prismaService.user.update({
      where: { id: user.id },
      data: {
        role: 'OWNER',
        lobby: { connect: { id: newLobby.id } },
        lobbyId: newLobby.id,
      },
    });

    return newLobby;
  }

  /**
   * Joins an existing lobby
   * @param lobbyId - ID of the lobby to join
   * @param user - The user joining the lobby
   * @returns Success message
   * @throws NotFoundException if lobby doesn't exist
   * @throws BadRequestException if user already in lobby or lobby is full
   */
  async joinLobby(lobbyId: string, user: UserWithLobbyRelations) {
    // Verify lobby exists
    const lobby = await this.prismaService.lobby.findUnique({
      where: { id: lobbyId },
    });

    if (!lobby) {
      throw new NotFoundException('Lobby not found');
    }

    // Verify user isn't already in a lobby
    if (user.memberLobby) {
      throw new BadRequestException('You already belong to or own a lobby');
    }

    // Check current member count
    const members = await this.prismaService.user.count({
      where: { lobbyId },
    });

    // Verify lobby has capacity
    if (members >= lobby.capacity) {
      throw new BadRequestException('This lobby is full');
    }

    // Add user to lobby
    await this.prismaService.user.update({
      where: { id: user.id },
      data: { lobbyId },
    });

    return { message: `Welcome to ${lobby.name}` };
  }

  /**
   * Retrieves the current user's lobby
   * @param user - The authenticated user
   * @returns The user's lobby details
   * @throws NotFoundException if user isn't in any lobby
   */
  async getMyLobby(user: UserWithLobbyRelations) {
    // Verify user is in a lobby
    if (!user.memberLobby) {
      throw new NotFoundException('You are not part of a lobby');
    }

    // Retrieve complete lobby details
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

  /**
   * Retrieves a specific lobby's details
   * @param lobbyId - ID of the lobby to retrieve
   * @param user - The authenticated user making the request
   * @returns The requested lobby details
   * @throws NotFoundException if lobby doesn't exist
   * @throws ForbiddenException if private lobby and user isn't a member
   */
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

    // Enforce private lobby access rules
    if (lobby.visibility === 'PRIVATE') {
      if (user.memberLobby?.id !== lobbyId) {
        throw new ForbiddenException(
          'Only members can access this private lobby',
        );
      }
    }

    return lobby;
  }

  /**
   * Updates a lobby's visibility setting
   * @param lobbyId - ID of the lobby to update
   * @param user - The authenticated user making the request
   * @param visibility - New visibility setting (PUBLIC/PRIVATE)
   * @returns The updated lobby
   * @throws NotFoundException if lobby doesn't exist
   * @throws ForbiddenException if user isn't the lobby owner
   */
  async updateLobbyVisibility(
    lobbyId: string,
    user: UserWithLobbyRelations,
    visibility: 'PRIVATE' | 'PUBLIC',
  ) {
    // Verify lobby exists
    const lobby = await this.prismaService.lobby.findUnique({
      where: { id: lobbyId },
    });

    if (!lobby) {
      throw new NotFoundException('Lobby not found');
    }

    // Verify requesting user is the owner
    if (lobby.ownerId !== user.id) {
      throw new ForbiddenException(
        'Only the owner can change the lobby visibility',
      );
    }

    // Update visibility setting
    const updatedLobby = await this.prismaService.lobby.update({
      where: { id: lobbyId },
      data: { visibility },
    });

    return updatedLobby;
  }
}
