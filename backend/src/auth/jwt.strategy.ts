import { Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import {
  Injectable,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from 'src/users/users.service';
import { UserWithLobbyRelations } from 'src/users/types/user.types';
import { AuthenticatedRequest } from './auth-request.interface';
import { JwtPayload } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    const secret = configService.get<string>('JWT_ACCESS_SECRET');
    if (!secret) {
      throw new InternalServerErrorException(
        'JWT_ACCESS_SECRET is not defined in config',
      );
    }

    super({
      jwtFromRequest: (req: AuthenticatedRequest) =>
        req.cookies?.accessToken || null,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<UserWithLobbyRelations> {
    const user = await this.usersService.findBySteamId(payload.steamId);
    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }
}
