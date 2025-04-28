import { Test, TestingModule } from '@nestjs/testing';
import { SteamStrategy } from './steam.strategy';
import { ConfigService } from '@nestjs/config';
import { UsersService } from 'src/users/users.service';
import {
  createMockProfile,
  createMockUser,
} from 'src/common/utils/test-utils/mockUser';

/**
 * Comprehensive test suite for SteamStrategy
 *
 * Tests the Steam authentication strategy including:
 * - User lookup and creation flows
 * - Error handling scenarios
 * - Proper integration with Passport.js
 */
describe('SteamStrategy', () => {
  let strategy: SteamStrategy;
  let usersService: UsersService;
  let configService: ConfigService;
  let consoleSpy: jest.SpyInstance; // Spy to track console.error calls
  let mockDone: jest.Mock; // Mock for the Passport done callback

  /**
   * Test setup before each case:
   * - Mocks console.error to prevent test pollution
   * - Initializes fresh mock instances
   * - Configures test module with mocked dependencies
   */
  beforeEach(async () => {
    // Prevent actual console.error output during tests
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    // Mock Passport's done callback
    mockDone = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SteamStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              // Mock configuration required for Steam auth
              const config = {
                NODE_ENV: 'test',
                STEAM_RETURN_URL: 'http://localhost:3000/auth/steam/return',
                STEAM_API_KEY: 'test-api-key',
                STEAM_REALM: 'http://localhost:3000/',
              };
              return config[key];
            }),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findBySteamId: jest.fn(),
            createUser: jest.fn(),
          },
        },
      ],
    }).compile();

    // Get fresh instances for each test
    strategy = module.get<SteamStrategy>(SteamStrategy);
    usersService = module.get<UsersService>(UsersService);
    configService = module.get<ConfigService>(ConfigService);
  });

  /**
   * Cleanup after each test:
   * - Restore original console.error implementation
   * - Clear mock call history
   */
  afterEach(() => {
    consoleSpy.mockRestore();
    mockDone.mockClear();
  });

  /**
   * Existing User Flow Tests
   *
   * Verifies behavior when authenticating an existing user:
   * - Proper user lookup
   * - No unnecessary user creation
   * - Correct callback handling
   */
  describe('when user exists', () => {
    it('should return existing user without creating new one', async () => {
      // Setup test data
      const mockUser = createMockUser();
      const mockProfile = createMockProfile();

      // Mock existing user found
      jest.spyOn(usersService, 'findBySteamId').mockResolvedValue(mockUser);

      // Execute validation
      await strategy.validate('identifier', mockProfile, mockDone);

      // Verify correct service interactions
      expect(usersService.findBySteamId).toHaveBeenCalledWith('steam-id');
      expect(usersService.createUser).not.toHaveBeenCalled();

      // Verify Passport callback called correctly
      expect(mockDone).toHaveBeenCalledWith(null, mockUser);
    });
  });

  /**
   * New User Flow Tests
   *
   * Verifies behavior when authenticating a new user:
   * - Proper user lookup failure
   * - Correct user creation
   * - Proper callback with new user
   */
  describe('when user does not exist', () => {
    it('should create new user with profile data', async () => {
      // Setup test data
      const mockUser = createMockUser();
      const mockProfile = createMockProfile();

      // Mock user not found then successful creation
      jest.spyOn(usersService, 'findBySteamId').mockResolvedValue(null);
      jest.spyOn(usersService, 'createUser').mockResolvedValue(mockUser);

      // Execute validation
      await strategy.validate('identifier', mockProfile, mockDone);

      // Verify correct service calls
      expect(usersService.findBySteamId).toHaveBeenCalledWith('steam-id');
      expect(usersService.createUser).toHaveBeenCalledWith({
        steamId: 'steam-id',
        username: 'testuser',
        avatar: 'avatar-url',
      });

      // Verify Passport callback with new user
      expect(mockDone).toHaveBeenCalledWith(null, mockUser);
    });
  });

  /**
   * Error Handling Tests
   *
   * Verifies proper error handling for:
   * - User lookup failures
   * - User creation failures
   * - Error logging
   */
  describe('error handling', () => {
    it('should handle user lookup failures', async () => {
      // Setup test data
      const mockProfile = createMockProfile();
      const mockError = new Error('Database error');

      // Force lookup failure
      jest.spyOn(usersService, 'findBySteamId').mockRejectedValue(mockError);

      // Execute validation
      await strategy.validate('identifier', mockProfile, mockDone);

      // Verify error logging
      expect(consoleSpy).toHaveBeenCalledWith(
        'Steam validation error:',
        expect.any(Error),
      );

      // Verify error passed to Passport
      expect(mockDone).toHaveBeenCalledWith(mockError, null);
    });

    it('should handle user creation failures', async () => {
      // Setup test data
      const mockProfile = createMockProfile();
      const mockError = new Error('Creation failed');

      // Mock user not found but creation fails
      jest.spyOn(usersService, 'findBySteamId').mockResolvedValue(null);
      jest.spyOn(usersService, 'createUser').mockRejectedValue(mockError);

      // Execute validation
      await strategy.validate('identifier', mockProfile, mockDone);

      // Verify error logging
      expect(consoleSpy).toHaveBeenCalledWith(
        'Steam validation error:',
        expect.any(Error),
      );

      // Verify error passed to Passport
      expect(mockDone).toHaveBeenCalledWith(mockError, null);
    });
  });
});
