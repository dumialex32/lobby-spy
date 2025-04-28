import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

/**
 * Authentication Service
 *
 * Handles all JWT-related operations including:
 * - Token generation
 * - Token verification
 * - JWT configuration management
 */
@Injectable()
export class AuthService {
  /**
   * Service constructor
   * @param jwtService - NestJS JWT service for token operations
   * @param configService - Configuration service for JWT settings
   */
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Generates a JWT token for the specified user
   * @param user - User entity containing authentication data
   * @returns Promise resolving to the signed JWT token
   *
   * The token includes these standard claims:
   * - sub: User ID (subject)
   * - steamId: User's Steam identifier
   * - username: User's display name
   *
   * Token expiration and secret are configured via environment variables
   */
  async generateJwt(user: User): Promise<string> {
    // Construct JWT payload with user data
    const payload = {
      sub: user.id, // Standard JWT subject claim
      steamId: user.steamId, // Custom claim for Steam ID
      username: user.username, // Custom claim for username
    };

    // Generate and sign the token
    return this.jwtService.signAsync(payload, {
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '1d', // Default 1 day expiration
      secret: this.configService.get<string>('JWT_SECRET'), // Secret key from config
    });
  }

  /**
   * Verifies a JWT token's validity and extracts its payload
   * @param token - JWT token to verify
   * @returns Promise resolving to the decoded token payload
   * @throws {Error} If token verification fails (expired, invalid signature, etc.)
   *
   * Uses the same secret key that was used to sign the token
   */
  async verifyToken(token: string): Promise<any> {
    return this.jwtService.verifyAsync(token, {
      secret: this.configService.get<string>('JWT_SECRET'), // Must match signing secret
    });
  }
}
