import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthenticatedRequest } from './auth-request.interface';
import { AuthService } from './auth.service';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

@Controller('auth') // All routes here are prefixed with /auth
export class AuthController {
  constructor(
    private readonly authService: AuthService, // Handles JWT generation logic
    private configService: ConfigService, // Access to environment variables
  ) {}

  /**
   * Helper method to extract cookie configuration based on environment.
   * DRY principle: used for both setting and clearing cookies.
   */
  private getCookieSettings() {
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';

    const domain: string =
      (isProd
        ? this.configService.get<string>('PROD_COOKIE_DOMAIN') // e.g., 'yourdomain.com'
        : this.configService.get<string>('COOKIE_DOMAIN')) || 'localhost';

    return { isProd, domain };
  }

  /**
   * @route GET /auth/steam
   * Initiates Steam login using Passport's Steam strategy.
   * The user is redirected to Steam's OAuth page.
   */
  @Get('steam')
  @UseGuards(AuthGuard('steam'))
  async steamLogin() {
    // This route is handled by Passport; no logic needed here.
  }

  /**
   * @route GET /auth/steam/return
   * Steam redirects the user back to this route after login.
   * We generate a JWT and send it back as an HTTP-only cookie.
   */
  @Get('steam/return')
  @UseGuards(AuthGuard('steam'))
  async steamCallback(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    // Generate a signed JWT token with user info
    const jwt = await this.authService.generateJwt(req.user);

    // Get environment-specific cookie settings
    const { isProd, domain } = this.getCookieSettings();

    // Get frontend URL to redirect after successful login
    const prodFrontEnd = this.configService.get<string>('PROD_FRONTEND_URL');
    const devFrontEnd = this.configService.get<string>('FRONTEND_URL');

    // Set the cookie with JWT for client session storage
    res.cookie('jwt', jwt, {
      httpOnly: true, // Prevent JS access (XSS protection)
      secure: isProd, // Send only over HTTPS in production
      sameSite: 'lax', // Prevent CSRF with cross-site requests
      domain, // Matches frontend domain
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // Cookie expires in 7 days
    });

    // Redirect user to frontend login success page
    res.redirect(
      isProd ? `${prodFrontEnd}/login/success` : `${devFrontEnd}/login/success`,
    );
  }

  /**
   * @route GET /auth/me
   * Protected route that returns the authenticated user's data.
   * Uses JwtAuthGuard to validate the token from the cookie.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Req() req: AuthenticatedRequest) {
    // `req.user` is populated by JwtStrategy if token is valid
    return req.user;
  }

  /**
   * @route GET /auth/logout
   * Logs out the user by clearing the JWT cookie.
   */
  @Get('logout')
  logout(@Res() res: Response) {
    const { isProd, domain } = this.getCookieSettings();

    // Clear the JWT cookie by matching the same attributes used to set it
    res.clearCookie('jwt', {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      domain,
      path: '/',
    });

    // Return success response
    return res.status(200).json({ message: 'Logged out successfully' });
  }
}
