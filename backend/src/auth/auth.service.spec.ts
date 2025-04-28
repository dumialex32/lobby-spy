import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createMockUser } from 'src/common/utils/test-utils/mockUser';

/**
 * Comprehensive test suite for AuthService
 *
 * Tests all authentication service functionality including:
 * - JWT token generation
 * - JWT token verification
 * - Configuration handling
 */
describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let configService: ConfigService;

  /**
   * Test module setup before each test case
   * - Configures all dependencies with mock implementations
   * - Sets up mock JWT service with token generation/verification
   * - Mocks configuration values for JWT settings
   */
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('mock-jwt-token'),
            verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-id' }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              switch (key) {
                case 'JWT_SECRET':
                  return 'test-secret'; // Mock secret for testing
                case 'JWT_EXPIRES_IN':
                  return '1d'; // Standard expiration
                default:
                  return null;
              }
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
  });

  /**
   * JWT Generation Tests
   *
   * Verifies the token generation process including:
   * - Proper payload construction
   * - Correct configuration usage
   * - Successful token return
   */
  describe('generateJwt', () => {
    it('should generate a JWT token with proper payload and configuration', async () => {
      // Mock user data
      const mockUser = createMockUser({
        id: 'user-id',
        steamId: 'steam-id',
        username: 'testuser',
      });

      // Execute token generation
      const result = await service.generateJwt(mockUser as any);

      // Verify returned token
      expect(result).toBe('mock-jwt-token');

      // Verify JWT service was called with correct payload
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        {
          sub: 'user-id', // Standard JWT subject claim
          steamId: 'steam-id', // Custom claim
          username: 'testuser', // Custom claim
        },
        {
          expiresIn: '1d', // From config
          secret: 'test-secret', // From config
        },
      );
    });

    // Edge case: Empty user data
    it('should handle minimal user data', async () => {
      const minimalUser = { id: 'user-id' };
      await service.generateJwt(minimalUser as any);

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'user-id' }),
        expect.any(Object),
      );
    });
  });

  /**
   * JWT Verification Tests
   *
   * Verifies the token verification process including:
   * - Proper token validation
   * - Correct secret usage
   * - Payload extraction
   */
  describe('verifyToken', () => {
    it('should verify a JWT token using configured secret', async () => {
      const testToken = 'test-token-123';
      const result = await service.verifyToken(testToken);

      // Verify returned payload
      expect(result).toEqual({ sub: 'user-id' });

      // Verify JWT service was called correctly
      expect(jwtService.verifyAsync).toHaveBeenCalledWith(testToken, {
        secret: 'test-secret',
      });
    });

    // Error case: Invalid token
    it('should propagate verification errors', async () => {
      (jwtService.verifyAsync as jest.Mock).mockRejectedValue(
        new Error('Invalid token'),
      );

      await expect(service.verifyToken('invalid-token')).rejects.toThrow(
        'Invalid token',
      );
    });
  });

  /**
   * Configuration Tests
   *
   * Verifies proper handling of configuration values
   */
  describe('Configuration', () => {
    it('should use correct JWT configuration', () => {
      // Verify config service was queried for required values
      expect(configService.get).toHaveBeenCalledWith('JWT_SECRET');
      expect(configService.get).toHaveBeenCalledWith('JWT_EXPIRES_IN');
    });
  });
});
