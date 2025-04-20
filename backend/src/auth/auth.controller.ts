import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard'; // Ensure correct import
import { AuthenticatedRequest } from './auth-request.interface'; // Ensure correct import
import { AuthService } from './auth.service'; // Your service to generate JWTs
import { Response } from 'express'; // Correct import
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('steam')
  @UseGuards(AuthGuard('steam'))
  async steamLogin() {
    // Redirect to Steam login page
  }

  @Get('steam/return')
  @UseGuards(AuthGuard('steam'))
  async steamCallback(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    const jwt = await this.authService.generateJwt(req.user);

    // Set the JWT as an HTTP-only cookie, with production-specific settings
    res.cookie('jwt', jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
      sameSite: 'lax',
      domain:
        process.env.NODE_ENV === 'production' ? 'mydomain.com' : 'localhost', // Set to your domain in production
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    res.redirect(
      process.env.NODE_ENV === 'production'
        ? 'https://myfrontend.com/login/success'
        : 'http://localhost:5713/login/success',
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Req() req: AuthenticatedRequest) {
    return req.user; // Return the user data attached by the JwtStrategy
  }
}
