import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createMockUser } from 'src/common/utils/test-utils/mockUser';
import { UserWithLobbyRelations } from 'src/users/types/user.types';

/**
 * AuthService Test Suite
 *
 * Tests the core authentication service functionality including:
 * - JWT token generation
 * - JWT token verification
 * - Configuration handling
 *
 * Uses mocked JwtService and ConfigService to isolate tests
 */
describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let configService: ConfigService;

  /**
   * Test setup before each test case
   * - Creates fresh testing module
   * - Mocks JWT service with token generation/verification
   * - Mocks configuration service with test values
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
                  return 'test-secret'; // Mock JWT signing secret
                case 'JWT_EXPIRES_IN':
                  return '1d'; // Mock token expiration
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
   * Verifies token creation with:
   * - Proper payload construction
   * - Correct configuration usage
   */
  describe('generateJwt', () => {
    it('should generate token with user data and proper config', async () => {
      // Arrange: Create mock user
      const mockUser = createMockUser({
        id: 'user-id',
        steamId: 'steam-id',
        username: 'testuser',
      });

      // Act: Generate token
      const result = await service.generateJwt(mockUser);

      // Assert: Verify results
      expect(result).toBe('mock-jwt-token');

      // Verify payload structure
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        {
          sub: 'user-id',
          steamId: 'steam-id',
          username: 'testuser',
        },
        {
          expiresIn: '1d',
          secret: 'test-secret',
        },
      );

      // Verify config was accessed
      expect(configService.get).toHaveBeenCalledWith('JWT_SECRET');
      expect(configService.get).toHaveBeenCalledWith('JWT_EXPIRES_IN');
    });

    it('should work with minimal required user data', async () => {
      // Arrange: Minimal required user data
      const minimalUser = createMockUser({
        id: 'user-id',
        steamId: 'steam-id',
      });

      // Act & Assert: Should work with required fields
      await service.generateJwt(minimalUser);
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'user-id',
          steamId: 'steam-id',
        }),
        expect.any(Object),
      );
    });
  });

  /**
   * Token Verification Tests
   *
   * Verifies token validation with:
   * - Proper secret usage
   * - Error propagation
   */
  describe('verifyToken', () => {
    it('should verify token using configured secret', async () => {
      // Arrange: Test token
      const testToken = 'test-token-123';

      // Act: Verify token
      const result = await service.verifyToken(testToken);

      // Assert: Verify results
      expect(result).toEqual({ sub: 'user-id' });
      expect(jwtService.verifyAsync).toHaveBeenCalledWith(testToken, {
        secret: 'test-secret',
      });
      expect(configService.get).toHaveBeenCalledWith('JWT_SECRET');
    });

    it('should propagate verification errors', async () => {
      // Arrange: Mock verification failure
      (jwtService.verifyAsync as jest.Mock).mockRejectedValue(
        new Error('Invalid token'),
      );

      // Act & Assert: Verify error is thrown
      await expect(service.verifyToken('invalid-token')).rejects.toThrow(
        'Invalid token',
      );
    });
  });

  /**
   * Configuration Tests
   *
   * Verifies proper configuration handling by
   * checking calls during actual method execution
   */
  describe('Configuration', () => {
    it('should access config when generating tokens', async () => {
      // Act: Call token generation with valid user
      await service.generateJwt(
        createMockUser({
          id: 'user-id',
          steamId: 'steam-id',
        }),
      );

      // Assert: Verify config was accessed
      expect(configService.get).toHaveBeenCalledWith('JWT_SECRET');
      expect(configService.get).toHaveBeenCalledWith('JWT_EXPIRES_IN');
    });

    it('should access config when verifying tokens', async () => {
      // Act: Call token verification
      await service.verifyToken('any-token');

      // Assert: Verify config was accessed
      expect(configService.get).toHaveBeenCalledWith('JWT_SECRET');
    });
  });
});
