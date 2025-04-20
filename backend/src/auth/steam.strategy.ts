import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-steam';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../users/user.service'; // Changed to relative import
import { User } from '@prisma/client';

interface SteamProfile {
  id: string;
  displayName: string;
  photos?: Array<{ value: string }>;
}

@Injectable()
export class SteamStrategy extends PassportStrategy(Strategy, 'steam') {
  constructor(
    private readonly usersService: UserService,
    configService: ConfigService,
  ) {
    super({
      returnURL: configService.get<string>('STEAM_RETURN_URL', ''),
      realm: configService.get<string>('STEAM_REALM', ''),
      apiKey: configService.get<string>('STEAM_API_KEY', ''),
    });
  }

  async validate(
    identifier: string,
    profile: SteamProfile,
    done: (error: Error | null, user: User | null) => void,
  ): Promise<void> {
    try {
      const { id, displayName, photos = [] } = profile;

      let user = await this.usersService.findBySteamId(id);
      if (!user) {
        user = await this.usersService.createUser({
          steamId: id,
          username: displayName,
          avatar: photos[2]?.value ?? photos[0]?.value ?? null,
        });
      }

      done(null, user);
    } catch (error: unknown) {
      done((error as Error) ?? new Error('Authentication failed'), null);
    }
  }
}
