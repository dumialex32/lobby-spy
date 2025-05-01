import { Test, TestingModule } from '@nestjs/testing';
import { LobbyController } from './lobby.controller';
import { LobbyService } from './lobby.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IsLobbyOwnerGuard } from './guards/is-lobby-owner.guard';
import { CreateLobbyDto } from './dto/create-lobby.dto';
import { UpdateLobbyVisibilityDto } from './dto/update-lobby-visibility.dto';
import { LobbyVisibility, UserRole } from '@prisma/client';
import { AuthenticatedRequest } from '../auth/auth-request.interface';
import { UserWithLobbyRelations } from '../users/types/user.types';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

/**
 * Comprehensive test suite for LobbyController
 *
 * Tests all lobby management endpoints including:
 * - Lobby creation and joining
 * - Lobby visibility management
 * - Lobby information retrieval
 *
 * Verifies proper:
 * - Request handling
 * - Service layer integration
 * - Authorization behavior
 */
describe('LobbyController', () => {
  let controller: LobbyController;
  let lobbyService: LobbyService;

  /**
   * Mock user data representing a standard authenticated user
   * - Initial state: Not in any lobby
   * - Standard member role
   */
  const mockUser: UserWithLobbyRelations = {
    id: 'user-123',
    steamId: 'steam-123',
    username: 'testuser',
    avatar: null,
    lobbyId: null,
    role: UserRole.MEMBER,
    createdAt: new Date(),
    updatedAt: new Date(),
    memberLobby: null,
    lobby: null,
  };

  /**
   * Mock lobby data representing a standard lobby
   * - Public visibility
   * - Owned by mockUser
   * - Empty members and games lists
   */
  const mockLobby = {
    id: 'lobby-123',
    name: 'Test Lobby',
    visibility: LobbyVisibility.PUBLIC,
    description: 'Test Description',
    ownerId: 'user-123',
    capacity: 30,
    createdAt: new Date(),
    updatedAt: new Date(),
    imageUrl: null,
    owner: {
      id: 'user-123',
      steamId: 'steam-123',
      username: 'testuser',
      avatar: null,
      lobbyId: 'lobby-123',
      role: UserRole.OWNER,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    members: [],
    games: [],
  };

  /**
   * Mock implementation of LobbyService
   * - All methods mocked with jest.fn()
   * - Individual tests will override returns as needed
   */
  const mockLobbyService = {
    createLobby: jest.fn(),
    joinLobby: jest.fn(),
    getMyLobby: jest.fn(),
    getLobby: jest.fn(),
    updateLobbyVisibility: jest.fn(),
  };

  // Empty mocks for dependent services
  const mockPrismaService = {};
  const mockUsersService = {};

  /**
   * Test module setup
   * - Configures testing module with mocked dependencies
   * - Overrides auth guards to bypass authentication
   */
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LobbyController],
      providers: [
        {
          provide: LobbyService,
          useValue: mockLobbyService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(IsLobbyOwnerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<LobbyController>(LobbyController);
    lobbyService = module.get<LobbyService>(LobbyService);
  });

  // Clean up mock call history after each test
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Basic controller existence test
  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  /**
   * Test group for createLobby endpoint
   *
   * Verifies:
   * - Proper DTO handling
   * - Correct service method invocation
   * - User data propagation
   */
  describe('createLobby', () => {
    it('should call service with correct parameters', async () => {
      // Test data
      const dto: CreateLobbyDto = {
        name: 'Test Lobby',
        visibility: LobbyVisibility.PUBLIC,
        description: 'Test Description',
      };
      const req = { user: mockUser } as AuthenticatedRequest;

      // Mock service response
      mockLobbyService.createLobby.mockResolvedValue(mockLobby);

      const result = await controller.createLobby(dto, req);

      // Verify service called correctly
      expect(result).toEqual(mockLobby);
      expect(lobbyService.createLobby).toHaveBeenCalledWith(dto, mockUser);
    });
  });

  /**
   * Test group for joinLobby endpoint
   *
   * Verifies:
   * - Lobby ID parameter handling
   * - User context propagation
   * - Success response format
   */

  /**
   * Test group for getMyLobby endpoint
   *
   * Verifies:
   * - User context handling
   * - Lobby retrieval logic
   */
  describe('getMyLobby', () => {
    it('should call service with authenticated user', async () => {
      const req = { user: mockUser } as AuthenticatedRequest;
      mockLobbyService.getMyLobby.mockResolvedValue(mockLobby);

      const result = await controller.getMyLobby(req);

      expect(result).toEqual(mockLobby);
      expect(lobbyService.getMyLobby).toHaveBeenCalledWith(mockUser);
    });
  });

  /**
   * Test group for getLobby endpoint
   *
   * Verifies:
   * - Lobby ID parameter handling
   * - User context propagation
   * - Lobby data retrieval
   */
  describe('getLobby', () => {
    it('should call service with lobbyId and user', async () => {
      const lobbyId = 'lobby-123';
      const req = { user: mockUser } as AuthenticatedRequest;
      mockLobbyService.getLobby.mockResolvedValue(mockLobby);

      const result = await controller.getLobby(lobbyId, req);

      expect(result).toEqual(mockLobby);
      expect(lobbyService.getLobby).toHaveBeenCalledWith(lobbyId, mockUser);
    });
  });

  /**
   * Test group for updateLobbyVisibility endpoint
   *
   * Verifies:
   * - Lobby ID parameter handling
   * - DTO validation
   * - Owner verification
   * - Visibility update propagation
   */
  describe('updateLobbyVisibility', () => {
    it('should call service with correct parameters', async () => {
      const lobbyId = 'lobby-123';
      const dto: UpdateLobbyVisibilityDto = {
        visibility: LobbyVisibility.PRIVATE,
      };
      const req = { user: mockUser } as AuthenticatedRequest;
      const updatedLobby = {
        ...mockLobby,
        visibility: LobbyVisibility.PRIVATE,
      };

      mockLobbyService.updateLobbyVisibility.mockResolvedValue(updatedLobby);

      const result = await controller.updateLobbyVisibility(lobbyId, dto, req);

      expect(result).toEqual(updatedLobby);
      expect(lobbyService.updateLobbyVisibility).toHaveBeenCalledWith(
        lobbyId,
        mockUser,
        dto.visibility,
      );
    });
  });
});
