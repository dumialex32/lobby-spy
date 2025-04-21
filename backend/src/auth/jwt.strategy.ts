import { Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { UsersService } from 'src/users/users.service';
import { UserWithLobbyRelations } from 'src/users/types/user.types';

// Define a return type for the validation
interface JwtPayload {
  sub: string; // or userId
  steamId: string;
}

// Create an interface for the request with cookies
interface AuthenticatedRequest extends Request {
  cookies: { jwt: string };
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: (req: AuthenticatedRequest) => req.cookies?.jwt || null,
      secretOrKey: configService.get('JWT_SECRET') || 'defaultSecretKey',
    });
  }

  async validate(payload: JwtPayload): Promise<UserWithLobbyRelations> {
    const user = await this.usersService.findBySteamId(payload.steamId);
    if (!user) throw new UnauthorizedException('User not found');

    return user;
  }
}
