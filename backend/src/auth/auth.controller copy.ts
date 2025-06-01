import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthenticatedRequest } from './auth-request.interface';
import { AuthService } from './auth.service';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { UsersService } from '../users/users.service';

interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private configService: ConfigService,
    private usersService: UsersService,
  ) {}

  private getCookieSettings(): { isProd: boolean; domain: string } {
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    const domain: string =
      (isProd
        ? this.configService.get<string>('PROD_COOKIE_DOMAIN')
        : this.configService.get<string>('COOKIE_DOMAIN')) || 'localhost';

    return { isProd, domain };
  }

  @Get('steam')
  @UseGuards(AuthGuard('steam'))
  async steamLogin() {
    // Passport handles this route
  }

  @Get('steam/return')
  @UseGuards(AuthGuard('steam'))
  async steamCallback(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    const accessToken = await this.authService.generateAccessToken(req.user);
    const refreshToken = await this.authService.generateRefreshToken(req.user);

    const { isProd, domain } = this.getCookieSettings();
    const frontendUrl = isProd
      ? this.configService.get<string>('PROD_FRONTEND_URL')
      : this.configService.get<string>('FRONTEND_URL');

    res.cookie('jwt', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      domain,
      path: '/',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      domain,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.redirect(`${frontendUrl}/login/success`);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Req() req: AuthenticatedRequest) {
    return req.user;
  }

  @Post('refresh')
  @UseGuards(RefreshTokenGuard)
  async refreshTokens(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    const refreshToken = req.cookies?.refreshToken as string;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    const tokens: TokenResponse =
      await this.authService.refreshTokens(refreshToken);
    const { isProd, domain } = this.getCookieSettings();

    res.cookie('jwt', tokens.accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      domain,
      path: '/',
      maxAge: 15 * 60 * 1000,
    });

    return res.status(200).json({ message: 'Tokens refreshed successfully' });
  }

  @Get('logout')
  logout(@Res() res: Response) {
    const { isProd, domain } = this.getCookieSettings();

    res.clearCookie('jwt', {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      domain,
      path: '/',
    });

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      domain,
      path: '/',
    });

    return res.status(200).json({ message: 'Logged out successfully' });
  }
}
