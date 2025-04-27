import { Test, TestingModule } from '@nestjs/testing';
import { LobbyController } from './lobby.controller';
import { LobbyService } from './lobby.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IsLobbyOwnerGuard } from './guards/is-lobby-owner.guard';
import { CreateLobbyDto } from './dto/create-lobby.dto';
import { UpdateLobbyVisibilityDto } from './dto/update-lobby-visibility.dto';
import { LobbyVisibility, UserRole } from '@prisma/client';
import { AuthenticatedRequest } from '../auth/auth-request.interface';
import { UserWithLobbyRelations } from '../users/types/user.types';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

/**
 * Test suite for LobbyController
 */
describe('LobbyController', () => {
  let controller: LobbyController;
  let lobbyService: LobbyService;

  // Mock user data for testing
  const mockUser: UserWithLobbyRelations = {
    id: 'user-123',
    steamId: 'steam-123',
    username: 'testuser',
    avatar: null,
    lobbyId: null,
    role: UserRole.MEMBER,
    createdAt: new Date(),
    updatedAt: new Date(),
    memberLobby: null, // Not in any lobcby initially
    lobby: null,
  };

  // Mock lobby data for testing
  const mockLobby = {
    id: 'lobby-123',
    name: 'Test Lobby',
    visibility: LobbyVisibility.PUBLIC,
    description: 'Test Description',
    ownerId: 'user-123', // Owned by our mock user
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
      role: UserRole.OWNER, // Owner role
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    members: [], // Empty members array
    games: [], // Empty games array
  };

  // Mock LobbyService methods
  const mockLobbyService = {
    createLobby: jest.fn(),
    joinLobby: jest.fn(),
    getMyLobby: jest.fn(),
    getLobby: jest.fn(),
    updateLobbyVisibility: jest.fn(),
  };

  // Empty mocks for other services
  const mockPrismaService = {};
  const mockUsersService = {};

  // Setup test module before each test
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
      // Override guards to always return true for testing
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(IsLobbyOwnerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<LobbyController>(LobbyController);
    lobbyService = module.get<LobbyService>(LobbyService);
  });

  // Clean up mocks after each test
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Basic controller existence test
  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  /**
   * Test suite for createLobby endpoint
   */
  describe('createLobby', () => {
    it('should call service with correct parameters', async () => {
      // Arrange: Prepare test data and mocks
      const dto: CreateLobbyDto = {
        name: 'Test Lobby',
        visibility: LobbyVisibility.PUBLIC,
        description: 'Test Description',
      };
      const req = { user: mockUser } as AuthenticatedRequest;
      mockLobbyService.createLobby.mockResolvedValue(mockLobby);

      // Act: Call the controller method
      const result = await controller.createLobby(dto, req);

      // Assert: Verify results and calls
      expect(result).toEqual(mockLobby);
      expect(lobbyService.createLobby).toHaveBeenCalledWith(dto, mockUser);
    });
  });

  /**
   * Test suite for joinLobby endpoint
   */
  describe('joinLobby', () => {
    it('should call service with correct parameters', async () => {
      // Arrange: Prepare test data and mocks
      const lobbyId = 'lobby-123';
      const req = { user: mockUser } as AuthenticatedRequest;
      const successMessage = { message: `Welcome to ${mockLobby.name}` };
      mockLobbyService.joinLobby.mockResolvedValue(successMessage);

      // Act: Call the controller method
      const result = await controller.joinLobby(lobbyId, req);

      // Assert: Verify results and calls
      expect(result).toEqual(successMessage);
      expect(lobbyService.joinLobby).toHaveBeenCalledWith(lobbyId, mockUser);
    });
  });

  /**
   * Test suite for getMyLobby endpoint
   */
  describe('getMyLobby', () => {
    it('should call service with authenticated user', async () => {
      // Arrange: Prepare test data and mocks
      const req = { user: mockUser } as AuthenticatedRequest;
      mockLobbyService.getMyLobby.mockResolvedValue(mockLobby);

      // Act: Call the controller method
      const result = await controller.getMyLobby(req);

      // Assert: Verify results and calls
      expect(result).toEqual(mockLobby);
      expect(lobbyService.getMyLobby).toHaveBeenCalledWith(mockUser);
    });
  });

  /**
   * Test suite for getLobby endpoint
   */
  describe('getLobby', () => {
    it('should call service with lobbyId and user', async () => {
      // Arrange: Prepare test data and mocks
      const lobbyId = 'lobby-123';
      const req = { user: mockUser } as AuthenticatedRequest;
      mockLobbyService.getLobby.mockResolvedValue(mockLobby);

      // Act: Call the controller method
      const result = await controller.getLobby(lobbyId, req);

      // Assert: Verify results and calls
      expect(result).toEqual(mockLobby);
      expect(lobbyService.getLobby).toHaveBeenCalledWith(lobbyId, mockUser);
    });
  });

  /**
   * Test suite for updateLobbyVisibility endpoint
   */
  describe('updateLobbyVisibility', () => {
    it('should call service with correct parameters', async () => {
      // Arrange: Prepare test data and mocks
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

      // Act: Call the controller method
      const result = await controller.updateLobbyVisibility(lobbyId, dto, req);

      // Assert: Verify results and calls
      expect(result).toEqual(updatedLobby);
      expect(lobbyService.updateLobbyVisibility).toHaveBeenCalledWith(
        lobbyId,
        mockUser,
        dto.visibility,
      );
    });
  });
});
