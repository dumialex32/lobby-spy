import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';
import { UserWithLobbyRelations } from './types/user.types';

/**
 * Users Service
 *
 * Handles all user-related database operations including:
 * - User lookup by Steam ID
 * - User creation
 * - User data retrieval with lobby relationships
 *
 * This service acts as the main interface between the application
 * and the User database records.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Finds a user by their Steam ID
   * @param steamId - The user's unique Steam identifier
   * @returns The user with lobby relationships or null if not found
   *
   * Includes:
   * - Owned lobby (if user is a lobby owner)
   * - Member lobby (if user is a lobby member)
   */
  async findBySteamId(steamId: string): Promise<UserWithLobbyRelations | null> {
    return this.prisma.user.findUnique({
      where: { steamId },
      include: {
        lobby: true, // The lobby this user owns (if any)
        memberLobby: true, // The lobby this user is a member of (if any)
      },
    });
  }

  /**
   * Creates a new user record
   * @param data - User creation data
   * @param data.steamId - Required Steam ID
   * @param data.username - Optional display name
   * @param data.avatar - Optional avatar URL
   * @returns The newly created user
   *
   * Note: This creates a basic user record without any lobby associations.
   * Lobby relationships are typically added through other services.
   */
  async createUser(data: {
    steamId: string;
    username?: string;
    avatar?: string;
  }): Promise<User> {
    return await this.prisma.user.create({
      data, // Creates user with provided fields
    });
  }

  /**
   * Finds a user by Steam ID or throws an exception if not found
   * @param steamId - The user's unique Steam identifier
   * @returns The user with lobby relationships
   * @throws NotFoundException if user doesn't exist
   *
   * This is a convenience wrapper around findBySteamId that enforces
   * user existence in the application flow.
   */
  async getUserOrThrow(steamId: string): Promise<UserWithLobbyRelations> {
    const user = await this.findBySteamId(steamId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
