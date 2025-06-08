import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { AuthenticatedRequest } from './auth-request.interface';
import { createMockUser } from 'src/common/utils/test-utils/mockUser';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;
  let configService: ConfigService;

  const mockUser = createMockUser({
    id: 'user-id',
    steamId: 'steam-id',
    username: 'testuser',
  });

  const mockRequest = {
    user: mockUser,
    cookies: {
      refreshToken: 'mock-refresh-token',
    },
  } as AuthenticatedRequest;

  const mockResponse = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    redirect: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  } as unknown as Response;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            generateJwt: jest.fn().mockResolvedValue({
              accessToken: 'mock-access-token',
              refreshToken: 'mock-refresh-token',
            }),
            refreshTokens: jest.fn().mockResolvedValue({
              accessToken: 'new-access-token',
            }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              const config = {
                NODE_ENV: 'test',
                FRONTEND_URL: 'http://localhost:3000',
                COOKIE_DOMAIN: 'localhost',
                PROD_FRONTEND_URL: 'https://prod.example.com',
                PROD_COOKIE_DOMAIN: 'example.com',
              };
              return config[key];
            }),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard('steam'))
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('steamLogin', () => {
    it('should be defined and protected by Steam auth guard', () => {
      expect(controller.steamLogin).toBeDefined();
    });
  });

  describe('steamCallback', () => {
    it('should generate JWT using authenticated user data', async () => {
      await controller.steamCallback(mockRequest, mockResponse);
      expect(authService.generateJwt).toHaveBeenCalledWith(mockUser);
    });

    it('should set secure HTTP-only cookies with JWT tokens', async () => {
      await controller.steamCallback(mockRequest, mockResponse);

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'accessToken',
        'mock-access-token',
        expect.objectContaining({
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          domain: 'localhost',
        }),
      );

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'mock-refresh-token',
        expect.objectContaining({
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          domain: 'localhost',
        }),
      );
    });

    it('should redirect to frontend success route', async () => {
      await controller.steamCallback(mockRequest, mockResponse);
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/login/success',
      );
    });
  });

  describe('getMe', () => {
    it('should return authenticated user data', () => {
      const result = controller.getMe(mockRequest);
      expect(result).toEqual(mockUser);
    });
  });

  describe('logout', () => {
    it('should clear authentication cookies', () => {
      controller.logout(mockResponse);

      expect(mockResponse.clearCookie).toHaveBeenCalledWith(
        'accessToken',
        expect.objectContaining({
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          domain: 'localhost',
        }),
      );

      expect(mockResponse.clearCookie).toHaveBeenCalledWith(
        'refreshToken',
        expect.objectContaining({
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          domain: 'localhost',
        }),
      );
    });

    it('should return 200 status with success message', () => {
      controller.logout(mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Logged out successfully',
      });
    });
  });

  describe('refreshToken', () => {
    it('should refresh access token', async () => {
      await controller.refreshToken(mockRequest, mockResponse);

      expect(authService.refreshTokens).toHaveBeenCalledWith(
        'mock-refresh-token',
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'accessToken',
        'new-access-token',
        expect.objectContaining({
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          domain: 'localhost',
        }),
      );
    });
  });

  describe('Environment Configuration', () => {
    it('should enforce production security settings when in prod', async () => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        const config = {
          NODE_ENV: 'production',
          PROD_FRONTEND_URL: 'https://prod.example.com',
          PROD_COOKIE_DOMAIN: 'example.com',
        };
        return config[key];
      });

      await controller.steamCallback(mockRequest, mockResponse);

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'accessToken',
        'mock-access-token',
        expect.objectContaining({
          secure: true,
          domain: 'example.com',
        }),
      );

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        'https://prod.example.com/login/success',
      );
    });
  });
});
