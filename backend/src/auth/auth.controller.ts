import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthenticatedRequest } from './auth-request.interface';
import { AuthService } from './auth.service';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Get('steam')
  @UseGuards(AuthGuard('steam'))
  async steamLogin() {
    // Redirect to Steam login page
  }

  @Get('steam/return')
  @UseGuards(AuthGuard('steam'))
  async steamCallback(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    const jwt = await this.authService.generateJwt(req.user);

    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    const domain: string =
      (isProd
        ? this.configService.get<string>('PROD_COOKIE_DOMAIN')
        : this.configService.get<string>('COOKIE_DOMAIN')) || 'localhost';

    const prodFrontEnd = this.configService.get<string>('PROD_FRONTEND_URL');
    const devFrontEnd = this.configService.get<string>('FRONTEND_URL');

    // Set the JWT as an HTTP-only cookie, with production-specific settings
    res.cookie('jwt', jwt, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      domain,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    res.redirect(
      isProd ? `${prodFrontEnd}/login/success` : `${devFrontEnd}/login/success`,
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Req() req: AuthenticatedRequest) {
    return req.user; // Return the user data attached by the JwtStrategy
  }
}
