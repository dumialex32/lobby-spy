import { Test, TestingModule } from '@nestjs/testing';
import { LobbyService } from './lobby.service';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { UserWithLobbyRelations } from 'src/users/types/user.types';
import { CreateLobbyDto } from './dto/create-lobby.dto';
import { LobbyVisibility, UserRole } from '@prisma/client';
import { UsersService } from 'src/users/users.service';

/**
 * Comprehensive test suite for LobbyService
 *
 * Tests core lobby business logic including:
 * - Lobby creation and membership rules
 * - Visibility management
 * - Capacity validation
 * - Error scenarios
 */
describe('LobbyService', () => {
  let service: LobbyService;

  /**
   * Mock user data representing a standard user
   * - Initial state: Not in any lobby
   * - Standard member role
   */
  const mockUser: UserWithLobbyRelations = {
    id: 'user1',
    steamId: 'steam1',
    username: 'TestUser',
    avatar: 'avatar_url',
    role: UserRole.MEMBER,
    memberLobby: null,
    lobby: null,
    lobbyId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  /**
   * Mock lobby data representing a standard lobby
   * - Public visibility
   * - 30 member capacity
   * - Owned by mockUser
   */
  const mockLobby = {
    id: 'lobby1',
    name: 'Test Lobby',
    visibility: LobbyVisibility.PUBLIC,
    description: 'Test description',
    capacity: 30,
    ownerId: 'user1',
    owner: mockUser,
    members: [mockUser],
    imageUrl: 'image_url',
    games: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  /**
   * Mock PrismaService implementation
   * - Methods mocked with jest.fn()
   * - Individual tests will override returns as needed
   */
  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    lobby: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  // Mock UsersService implementation
  const mockUsersService = {
    getUserById: jest.fn(),
  };

  /**
   * Test module setup
   * - Configures testing module with mocked dependencies
   */
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LobbyService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    service = module.get<LobbyService>(LobbyService);
  });

  // Basic service existence test
  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  /**
   * Test group for createLobby functionality
   *
   * Verifies:
   * - User membership validation
   * - Lobby creation process
   * - Owner role assignment
   */
  describe('createLobby', () => {
    it('should throw ForbiddenException if user is already in a lobby', async () => {
      const userInLobby = { ...mockUser, memberLobby: mockLobby };
      const createLobbyDto: CreateLobbyDto = {
        name: 'New Lobby',
        visibility: LobbyVisibility.PUBLIC,
        description: 'A new lobby for testing',
      };

      await expect(
        service.createLobby(createLobbyDto, userInLobby),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create a lobby if user is not in any lobby', async () => {
      mockPrismaService.lobby.create.mockResolvedValue(mockLobby);
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      const createLobbyDto: CreateLobbyDto = {
        name: 'New Lobby',
        visibility: LobbyVisibility.PUBLIC,
        description: 'A new lobby for testing',
      };

      const result = await service.createLobby(createLobbyDto, mockUser);

      expect(result).toEqual(mockLobby);
      expect(mockPrismaService.lobby.create).toHaveBeenCalledWith({
        data: {
          name: createLobbyDto.name,
          visibility: createLobbyDto.visibility,
          imageUrl: createLobbyDto.imageUrl,
          description: createLobbyDto.description,
          owner: { connect: { id: mockUser.id } },
          members: { connect: { id: mockUser.id } },
        },
        include: {
          owner: true,
          members: true,
        },
      });
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          role: UserRole.OWNER,
          lobby: { connect: { id: mockLobby.id } },
          lobbyId: mockLobby.id,
        },
      });
    });
  });

  /**
   * Test group for getMyLobby functionality
   *
   * Verifies:
   * - Lobby existence validation
   * - Proper data retrieval
   */
  describe('getMyLobby', () => {
    it('should throw NotFoundException if user is not in any lobby', async () => {
      await expect(service.getMyLobby(mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should return user's lobby if they belong to one", async () => {
      const userInLobby = { ...mockUser, memberLobby: mockLobby };
      mockPrismaService.lobby.findUnique.mockResolvedValue(mockLobby);

      const result = await service.getMyLobby(userInLobby);

      expect(result).toEqual(mockLobby);
      expect(mockPrismaService.lobby.findUnique).toHaveBeenCalledWith({
        where: { id: mockLobby.id },
        include: {
          members: true,
          owner: true,
          games: true,
        },
      });
    });
  });

  /**
   * Test group for getLobby functionality
   *
   * Verifies:
   * - Lobby existence validation
   * - Visibility rules enforcement
   * - Member access rights
   */
  describe('getLobby', () => {
    it('should throw NotFoundException if lobby does not exist', async () => {
      mockPrismaService.lobby.findUnique.mockResolvedValue(null);

      await expect(service.getLobby('nonexistent', mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if lobby is private and user is not a member', async () => {
      const privateLobby = {
        ...mockLobby,
        visibility: LobbyVisibility.PRIVATE,
      };
      mockPrismaService.lobby.findUnique.mockResolvedValue(privateLobby);

      await expect(service.getLobby(privateLobby.id, mockUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return lobby if user is a member or owner', async () => {
      const privateLobby = {
        ...mockLobby,
        visibility: LobbyVisibility.PRIVATE,
      };
      const userInLobby = { ...mockUser, memberLobby: privateLobby };
      mockPrismaService.lobby.findUnique.mockResolvedValue(privateLobby);

      const result = await service.getLobby(privateLobby.id, userInLobby);

      expect(result).toEqual(privateLobby);
    });

    it('should return public lobby even if user is not a member', async () => {
      mockPrismaService.lobby.findUnique.mockResolvedValue(mockLobby);

      const result = await service.getLobby(mockLobby.id, mockUser);

      expect(result).toEqual(mockLobby);
    });
  });

  /**
   * Test group for updateLobbyVisibility functionality
   *
   * Verifies:
   * - Lobby existence validation
   * - Owner verification
   * - Successful visibility updates
   */
  describe('updateLobbyVisibility', () => {
    it('should throw NotFoundException if lobby does not exist', async () => {
      mockPrismaService.lobby.findUnique.mockResolvedValue(null);

      await expect(
        service.updateLobbyVisibility(
          'nonexistent',
          mockUser,
          LobbyVisibility.PRIVATE,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not the owner', async () => {
      const notOwner = { ...mockUser, id: 'user2' };
      mockPrismaService.lobby.findUnique.mockResolvedValue(mockLobby);

      await expect(
        service.updateLobbyVisibility(
          mockLobby.id,
          notOwner,
          LobbyVisibility.PRIVATE,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update the lobby visibility if user is the owner', async () => {
      mockPrismaService.lobby.findUnique.mockResolvedValue(mockLobby);
      const updatedLobby = {
        ...mockLobby,
        visibility: LobbyVisibility.PRIVATE,
      };
      mockPrismaService.lobby.update.mockResolvedValue(updatedLobby);

      const result = await service.updateLobbyVisibility(
        mockLobby.id,
        mockUser,
        LobbyVisibility.PRIVATE,
      );

      expect(result.visibility).toBe(LobbyVisibility.PRIVATE);
      expect(mockPrismaService.lobby.update).toHaveBeenCalledWith({
        where: { id: mockLobby.id },
        data: { visibility: LobbyVisibility.PRIVATE },
      });
    });
  });
});
