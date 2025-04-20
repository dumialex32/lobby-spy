import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-steam';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { User } from '@prisma/client';

interface SteamProfile {
  id: string;
  displayName: string;
  photos?: Array<{ value: string }>;
}

@Injectable()
export class SteamStrategy extends PassportStrategy(Strategy, 'steam') {
  constructor(
    private readonly usersService: UsersService,
    configService: ConfigService,
  ) {
    const isProd = configService.get('NODE_ENV') === 'production';
    const returnURL: string =
      (isProd
        ? configService.get<string>('PROD_STEAM_RETURN_URL')
        : configService.get<string>('STEAM_RETURN_URL')) ||
      'http://localhost:3000/auth/steam/return';
    console.log(returnURL);
    const apiKey =
      (isProd
        ? configService.get<string>('PROD_STEAM_API_KEY')
        : configService.get<string>('STEAM_API_KEY')) || '';

    const realm: string =
      (isProd
        ? configService.get<string>('PROD_STEAM_REALM')
        : configService.get<string>('STEAM_REALM')) || 'http://localhost:3000/';

    super({
      returnURL,
      realm,
      apiKey,
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
