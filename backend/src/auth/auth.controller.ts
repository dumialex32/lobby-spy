import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedRequest } from './auth-request.interface';
import { AuthService } from './auth.service';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private configService: ConfigService,
  ) {}

  private getCookieSettings() {
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    const domain: string =
      (isProd
        ? this.configService.get<string>('PROD_COOKIE_DOMAIN')
        : this.configService.get<string>('COOKIE_DOMAIN')) || 'localhost';

    return { isProd, domain };
  }

  @Get('steam')
  @UseGuards(AuthGuard('steam'))
  async steamLogin() {}

  @Get('steam/return')
  @UseGuards(AuthGuard('steam'))
  async steamCallback(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    const { accessToken, refreshToken } = await this.authService.generateJwt(
      req.user,
    );
    const { isProd, domain } = this.getCookieSettings();

    const prodFrontEnd = this.configService.get<string>('PROD_FRONTEND_URL');
    const devFrontEnd = this.configService.get<string>('FRONTEND_URL');

    // Set both access and refresh tokens as HTTP-only cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      domain,
      path: '/',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      domain,
      path: '/api/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.redirect(
      isProd ? `${prodFrontEnd}/login/success` : `${devFrontEnd}/login/success`,
    );
  }

  @Post('refresh')
  @UseGuards(RefreshTokenGuard)
  async refreshToken(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    const { accessToken } = await this.authService.refreshTokens(refreshToken);
    const { isProd, domain } = this.getCookieSettings();

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      domain,
      path: '/',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    return res.status(200).json({ message: 'Token refreshed successfully' });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Req() req: AuthenticatedRequest) {
    return req.user;
  }

  @Get('logout')
  logout(@Res() res: Response) {
    const { isProd, domain } = this.getCookieSettings();

    res.clearCookie('accessToken', {
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
      path: '/auth/refresh',
    });

    return res.status(200).json({ message: 'Logged out successfully' });
  }
}
