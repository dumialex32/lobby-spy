import { Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

// Define a return type for the validation
interface JwtPayload {
  sub: string; // or userId
  steamId: string;
}

// Create an interface for the request with cookies
interface AuthenticatedRequest extends Request {
  cookies: { jwt: string };
}

interface UserPayload {
  userId: string;
  steamId: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: (req: AuthenticatedRequest) => req.cookies?.jwt || null,
      secretOrKey: configService.get('JWT_SECRET') || 'defaultSecretKey',
    });
  }

  validate(payload: JwtPayload): UserPayload {
    return { userId: payload.sub, steamId: payload.steamId };
  }
}
