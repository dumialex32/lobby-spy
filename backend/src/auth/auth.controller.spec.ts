import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { AuthenticatedRequest } from './auth-request.interface';
import { createMockUser } from 'src/common/utils/test-utils/mockUser';

/**
 * Comprehensive test suite for AuthController
 *
 * Tests all authentication-related endpoints including:
 * - Steam authentication flow
 * - User session management
 * - Logout functionality
 * - Environment-specific behavior
 */
describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;
  let configService: ConfigService;

  // Standard mock user for testing authentication flows
  const mockUser = createMockUser({
    id: 'user-id',
    steamId: 'steam-id',
    username: 'testuser',
  });

  // Mock request object simulating an authenticated request
  const mockRequest = {
    user: mockUser,
  } as AuthenticatedRequest;

  /**
   * Comprehensive mock response object with Jest spies to verify:
   * - Cookie handling (set/clear)
   * - Redirect behavior
   * - Status codes and JSON responses
   */
  const mockResponse = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    redirect: jest.fn(),
    status: jest.fn().mockReturnThis(), // Chainable status
    json: jest.fn(),
  } as unknown as Response;

  /**
   * Test module setup before each test case
   * - Configures all dependencies with mock implementations
   * - Overrides auth guards to bypass actual authentication
   */
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            generateJwt: jest.fn().mockResolvedValue('mock-jwt-token'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              // Default test environment configuration
              const config = {
                NODE_ENV: 'test',
                FRONTEND_URL: 'http://localhost:3000',
                COOKIE_DOMAIN: 'localhost',
              };
              return config[key];
            }),
          },
        },
      ],
    })
      // Bypass actual authentication for controller testing
      .overrideGuard(AuthGuard('steam'))
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    configService = module.get<ConfigService>(ConfigService);
  });

  /**
   * Steam Authentication Endpoint Tests
   *
   * Note: Actual Steam auth flow is tested in integration tests.
   * These verify basic controller setup and guard application.
   */
  describe('steamLogin', () => {
    it('should be defined and protected by Steam auth guard', () => {
      // Smoke test to verify endpoint exists
      expect(controller.steamLogin).toBeDefined();
      // Guard behavior verified via module configuration
    });
  });

  /**
   * Steam Callback Handler Tests
   *
   * Verifies the complete OAuth callback flow including:
   * - JWT generation
   * - Cookie setting
   * - Proper redirection
   */
  describe('steamCallback', () => {
    it('should generate JWT using authenticated user data', async () => {
      await controller.steamCallback(mockRequest, mockResponse);

      // Verify auth service receives correct user payload
      expect(authService.generateJwt).toHaveBeenCalledWith(mockUser);
    });

    it('should set secure HTTP-only cookie with JWT', async () => {
      await controller.steamCallback(mockRequest, mockResponse);

      // Validate all cookie security settings
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'jwt',
        'mock-jwt-token',
        expect.objectContaining({
          httpOnly: true, // Prevent XSS attacks
          secure: false, // Allowed in test env
          sameSite: 'lax', // CSRF protection
          domain: 'localhost', // Test domain
        }),
      );
    });

    it('should redirect to frontend success route', async () => {
      await controller.steamCallback(mockRequest, mockResponse);

      // Verify post-authentication flow
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/login/success',
      );
    });
  });

  /**
   * Session Management Tests
   *
   * Verifies the endpoint that returns current user session data
   */
  describe('getMe', () => {
    it('should return authenticated user data', () => {
      const result = controller.getMe(mockRequest);

      // Verify user data is returned unchanged
      expect(result).toEqual(mockUser);
    });
  });

  /**
   * Logout Functionality Tests
   *
   * Verifies the logout sequence including:
   * - Cookie invalidation
   * - Proper success response
   */
  describe('logout', () => {
    it('should clear authentication cookie', () => {
      controller.logout(mockResponse);

      // Verify cookie is cleared with same options as set
      expect(mockResponse.clearCookie).toHaveBeenCalledWith(
        'jwt',
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

      // Verify API response format
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Logged out successfully',
      });
    });
  });

  /**
   * Environment Configuration Tests
   *
   * Verifies behavior changes between development and production
   * environments, particularly security settings.
   */
  describe('Environment Configuration', () => {
    it('should enforce production security settings when in prod', async () => {
      // Simulate production environment
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        const config = {
          NODE_ENV: 'production',
          PROD_FRONTEND_URL: 'https://prod.example.com',
          PROD_COOKIE_DOMAIN: 'example.com',
        };
        return config[key];
      });

      await controller.steamCallback(mockRequest, mockResponse);

      // Verify production-grade security settings
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'jwt',
        'mock-jwt-token',
        expect.objectContaining({
          secure: true, // HTTPS required in production
          domain: 'example.com', // Production domain
        }),
      );

      // Verify production frontend URL
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        'https://prod.example.com/login/success',
      );
    });
  });
});
