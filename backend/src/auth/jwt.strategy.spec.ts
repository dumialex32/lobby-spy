import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { ConfigService } from '@nestjs/config';
import { UsersService } from 'src/users/users.service';
import { UnauthorizedException } from '@nestjs/common';
import { createMockUser } from 'src/common/utils/test-utils/mockUser';

/**
 * Test suite for JwtStrategy
 *
 * This suite verifies the behavior of the JWT authentication strategy,
 * particularly focusing on the validation of JWT payloads and user lookup.
 */
describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let usersService: UsersService;

  /**
   * Setup before each test case:
   * - Creates a fresh testing module
   * - Mocks dependencies (ConfigService and UsersService)
   * - Retrieves fresh instances of the strategy and service
   */
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret'), // Mock JWT secret
          },
        },
        {
          provide: UsersService,
          useValue: {
            findBySteamId: jest.fn(), // Mock user lookup method
          },
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    usersService = module.get<UsersService>(UsersService);
  });

  /**
   * Test group for the validate() method
   * This is the core method that verifies JWT payloads and finds users
   */
  describe('validate', () => {
    /**
     * Happy path test - valid user exists
     * Verifies:
     * - Proper user lookup using steamId from JWT payload
     * - Correct user object is returned when found
     */
    it('should return user if found', async () => {
      // Setup mock user data
      const mockUser = createMockUser({
        id: 'user-id',
        steamId: 'steam-id',
      });

      // Mock the user service to return our test user
      jest
        .spyOn(usersService, 'findBySteamId')
        .mockResolvedValue(mockUser as any);

      // Execute validation with test JWT payload
      const result = await strategy.validate({
        sub: 'user-id', // Standard JWT subject claim
        steamId: 'steam-id', // Our custom claim
      });

      // Verify correct user is returned
      expect(result).toEqual(mockUser);
    });

    /**
     * Error case test - user not found
     * Verifies:
     * - Proper error is thrown when user doesn't exist
     * - Security: Invalid tokens don't authenticate
     */
    it('should throw UnauthorizedException if user not found', async () => {
      // Mock user service to return null (user not found)
      jest.spyOn(usersService, 'findBySteamId').mockResolvedValue(null);

      // Verify the strategy rejects with proper error
      await expect(
        strategy.validate({
          sub: 'user-id',
          steamId: 'steam-id',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
