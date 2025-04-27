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
 * Test suite for LobbyService
 */
describe('LobbyService', () => {
  let service: LobbyService;

  // Mock user data for testing
  const mockUser: UserWithLobbyRelations = {
    id: 'user1',
    steamId: 'steam1',
    username: 'TestUser',
    avatar: 'avatar_url',
    role: UserRole.MEMBER,
    memberLobby: null, // Initially not in any lobby
    lobby: null,
    lobbyId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Mock lobby data for testing
  const mockLobby = {
    id: 'lobby1',
    name: 'Test Lobby',
    visibility: LobbyVisibility.PUBLIC,
    description: 'Test description',
    capacity: 30,
    ownerId: 'user1', // Owned by our mock user
    owner: mockUser,
    members: [mockUser], // Contains our mock user as member
    imageUrl: 'image_url',
    games: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Mock Prisma service methods
  const mockPrismaService = {
    user: {
      findUnique: jest.fn(), // Mock user lookup
      update: jest.fn(), // Mock user updates
      count: jest.fn(), // Mock counting users
    },
    lobby: {
      create: jest.fn(), // Mock lobby creation
      findUnique: jest.fn(), // Mock lobby lookup
      update: jest.fn(), // Mock lobby updates
    },
  };

  // Mock UsersService
  const mockUsersService = {
    getUserById: jest.fn(), // Mock user retrieval
  };

  // Setup test module before each test
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
   * Test suite for createLobby functionality
   */
  describe('createLobby', () => {
    it('should throw ForbiddenException if user is already in a lobby', async () => {
      // Arrange: Create a user who is already in a lobby
      const userInLobby = { ...mockUser, memberLobby: mockLobby };
      const createLobbyDto: CreateLobbyDto = {
        name: 'New Lobby',
        visibility: LobbyVisibility.PUBLIC,
        description: 'A new lobby for testing',
      };

      // Act & Assert: Verify the service throws the expected exception
      await expect(
        service.createLobby(createLobbyDto, userInLobby),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create a lobby if user is not in any lobby', async () => {
      // Arrange: Mock the Prisma service responses
      mockPrismaService.lobby.create.mockResolvedValue(mockLobby);
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      const createLobbyDto: CreateLobbyDto = {
        name: 'New Lobby',
        visibility: LobbyVisibility.PUBLIC,
        description: 'A new lobby for testing',
      };

      // Act: Call the service method
      const result = await service.createLobby(createLobbyDto, mockUser);

      // Assert: Verify the results and calls
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
   * Test suite for joinLobby functionality
   */
  describe('joinLobby', () => {
    it('should throw BadRequestException if user is already in a lobby', async () => {
      // Arrange: User already in a lobby and mock lobby exists
      const userInLobby = { ...mockUser, memberLobby: mockLobby };
      mockPrismaService.lobby.findUnique.mockResolvedValue(mockLobby);

      // Act & Assert: Verify the service throws the expected exception
      await expect(
        service.joinLobby(mockLobby.id, userInLobby),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if lobby does not exist', async () => {
      // Arrange: Mock lobby not found
      mockPrismaService.lobby.findUnique.mockResolvedValue(null);

      // Act & Assert: Verify the service throws the expected exception
      await expect(service.joinLobby('nonexistent', mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if lobby is full', async () => {
      // Arrange: Mock lobby exists and is at capacity
      mockPrismaService.lobby.findUnique.mockResolvedValue(mockLobby);
      mockPrismaService.user.count.mockResolvedValue(mockLobby.capacity);

      // Act & Assert: Verify the service throws the expected exception
      await expect(service.joinLobby(mockLobby.id, mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should add user to the lobby if valid', async () => {
      // Arrange: Mock valid join scenario
      mockPrismaService.lobby.findUnique.mockResolvedValue(mockLobby);
      mockPrismaService.user.count.mockResolvedValue(29); // Below capacity
      mockPrismaService.user.update.mockResolvedValue({
        ...mockUser,
        lobbyId: mockLobby.id,
      });

      // Act: Call the service method
      const result = await service.joinLobby(mockLobby.id, mockUser);

      // Assert: Verify the results and calls
      expect(result).toEqual({ message: `Welcome to ${mockLobby.name}` });
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { lobbyId: mockLobby.id },
      });
    });
  });

  /**
   * Test suite for getMyLobby functionality
   */
  describe('getMyLobby', () => {
    it('should throw NotFoundException if user is not in any lobby', async () => {
      // Act & Assert: Verify the service throws for user not in lobby
      await expect(service.getMyLobby(mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should return user's lobby if they belong to one", async () => {
      // Arrange: User is in a lobby
      const userInLobby = { ...mockUser, memberLobby: mockLobby };
      mockPrismaService.lobby.findUnique.mockResolvedValue(mockLobby);

      // Act: Call the service method
      const result = await service.getMyLobby(userInLobby);

      // Assert: Verify the results and calls
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
   * Test suite for getLobby functionality
   */
  describe('getLobby', () => {
    it('should throw NotFoundException if lobby does not exist', async () => {
      // Arrange: Mock lobby not found
      mockPrismaService.lobby.findUnique.mockResolvedValue(null);

      // Act & Assert: Verify the service throws the expected exception
      await expect(service.getLobby('nonexistent', mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if lobby is private and user is not a member', async () => {
      // Arrange: Create private lobby and mock response
      const privateLobby = {
        ...mockLobby,
        visibility: LobbyVisibility.PRIVATE,
      };
      mockPrismaService.lobby.findUnique.mockResolvedValue(privateLobby);

      // Act & Assert: Verify the service throws the expected exception
      await expect(service.getLobby(privateLobby.id, mockUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return lobby if user is a member or owner', async () => {
      // Arrange: User is in a private lobby
      const privateLobby = {
        ...mockLobby,
        visibility: LobbyVisibility.PRIVATE,
      };
      const userInLobby = { ...mockUser, memberLobby: privateLobby };
      mockPrismaService.lobby.findUnique.mockResolvedValue(privateLobby);

      // Act: Call the service method
      const result = await service.getLobby(privateLobby.id, userInLobby);

      // Assert: Verify the results
      expect(result).toEqual(privateLobby);
    });

    it('should return public lobby even if user is not a member', async () => {
      // Arrange: Mock public lobby
      mockPrismaService.lobby.findUnique.mockResolvedValue(mockLobby);

      // Act: Call the service method
      const result = await service.getLobby(mockLobby.id, mockUser);

      // Assert: Verify the results
      expect(result).toEqual(mockLobby);
    });
  });

  /**
   * Test suite for updateLobbyVisibility functionality
   */
  describe('updateLobbyVisibility', () => {
    it('should throw NotFoundException if lobby does not exist', async () => {
      // Arrange: Mock lobby not found
      mockPrismaService.lobby.findUnique.mockResolvedValue(null);

      // Act & Assert: Verify the service throws the expected exception
      await expect(
        service.updateLobbyVisibility(
          'nonexistent',
          mockUser,
          LobbyVisibility.PRIVATE,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not the owner', async () => {
      // Arrange: User is not the owner
      const notOwner = { ...mockUser, id: 'user2' };
      mockPrismaService.lobby.findUnique.mockResolvedValue(mockLobby);

      // Act & Assert: Verify the service throws the expected exception
      await expect(
        service.updateLobbyVisibility(
          mockLobby.id,
          notOwner,
          LobbyVisibility.PRIVATE,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update the lobby visibility if user is the owner', async () => {
      // Arrange: User is the owner
      mockPrismaService.lobby.findUnique.mockResolvedValue(mockLobby);
      const updatedLobby = {
        ...mockLobby,
        visibility: LobbyVisibility.PRIVATE,
      };
      mockPrismaService.lobby.update.mockResolvedValue(updatedLobby);

      // Act: Call the service method
      const result = await service.updateLobbyVisibility(
        mockLobby.id,
        mockUser,
        LobbyVisibility.PRIVATE,
      );

      // Assert: Verify the results and calls
      expect(result.visibility).toBe(LobbyVisibility.PRIVATE);
      expect(mockPrismaService.lobby.update).toHaveBeenCalledWith({
        where: { id: mockLobby.id },
        data: { visibility: LobbyVisibility.PRIVATE },
      });
    });
  });
});
