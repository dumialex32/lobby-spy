import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, StrategyOptionsWithRequest } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService, JwtPayload } from './auth.service';
import { AuthenticatedRequest } from './auth-request.interface';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: (req: AuthenticatedRequest) =>
        req.cookies?.refreshToken || null,
      secretOrKey: configService.get<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
      ignoreExpiration: false,
    } as StrategyOptionsWithRequest);
  }

  async validate(req: AuthenticatedRequest, payload: JwtPayload) {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException({
        message: 'Refresh token not found in cookies',
        error: 'refresh_token_missing',
      });
    }

    try {
      await this.authService.verifyRefreshToken(refreshToken);
      return payload;
    } catch (error) {
      throw new UnauthorizedException({
        message: 'Invalid or expired refresh token',
        error: 'invalid_refresh_token',
      });
    }
  }
}
