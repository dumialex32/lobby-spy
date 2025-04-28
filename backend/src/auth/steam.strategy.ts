import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-steam';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import { UsersService } from 'src/users/users.service';

/**
 * Interface defining the structure of Steam profile data
 * received during authentication
 */
interface SteamProfile {
  id: string; // SteamID64 format
  displayName: string; // User's display name
  photos?: Array<{ value: string }>; // Array of profile photos in different sizes
}

/**
 * Steam Authentication Strategy
 *
 * Implements Passport.js strategy for Steam OpenID authentication
 * Handles both existing and new user authentication flows
 */
@Injectable()
export class SteamStrategy extends PassportStrategy(Strategy, 'steam') {
  /**
   * Strategy constructor
   * @param usersService - Service for user database operations
   * @param configService - Service for accessing configuration
   */
  constructor(
    private readonly usersService: UsersService,
    configService: ConfigService,
  ) {
    // Determine environment
    const isProd = configService.get('NODE_ENV') === 'production';

    // Configure return URL (where Steam redirects after auth)
    const returnURL: string =
      (isProd
        ? configService.get<string>('PROD_STEAM_RETURN_URL')
        : configService.get<string>('STEAM_RETURN_URL')) ||
      'http://localhost:3000/auth/steam/return'; // Fallback for local development

    // Get Steam Web API key
    const apiKey =
      (isProd
        ? configService.get<string>('PROD_STEAM_API_KEY')
        : configService.get<string>('STEAM_API_KEY')) || '';

    // Configure realm (domain that will be authenticated)
    const realm: string =
      (isProd
        ? configService.get<string>('PROD_STEAM_REALM')
        : configService.get<string>('STEAM_REALM')) || 'http://localhost:3000/';

    // Initialize Passport strategy with configuration
    super({
      returnURL, // Where Steam redirects after authentication
      realm, // Domain that will be authenticated
      apiKey, // Steam Web API key
    });
  }

  /**
   * Validation callback - called after successful Steam authentication
   * @param identifier - Unique Steam identifier
   * @param profile - User profile data from Steam
   * @param done - Passport callback function
   */
  async validate(
    identifier: string,
    profile: SteamProfile,
    done: (error: Error | null, user: User | null) => void,
  ): Promise<void> {
    try {
      // Extract relevant profile data
      const { id, displayName, photos = [] } = profile;

      // Check if user exists in database
      let user = await this.usersService.findBySteamId(id);

      // Create new user if not found
      if (!user) {
        user = await this.usersService.createUser({
          steamId: id,
          username: displayName,
          // Prefer larger photo (index 2) if available, fallback to first photo
          avatar: photos[2]?.value ?? photos[0]?.value ?? null,
        });
      }

      // Successful authentication - pass user to Passport
      done(null, user);
    } catch (error: unknown) {
      // Log and handle authentication errors
      console.error('Steam validation error:', error);

      // Ensure error is properly typed for Passport
      const authError = (error as Error) ?? new Error('Authentication failed');
      done(authError, null);
    }
  }
}
