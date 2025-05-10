/**
 * @fileoverview Unit tests for the LobbyService.
 * Covers join request creation, approval, member removal, and lobby creation logic.
 */

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
import {
  LobbyVisibility,
  UserRole,
  RequestStatus,
  Prisma,
} from '@prisma/client';
import { UsersService } from 'src/users/users.service';
import { LobbyGateway } from './lobby.gateway';

//#region Mock Data and Utilities

/** A mock user used across test cases */
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
 * Creates a mock lobby object with default values and optional overrides.
 * @param overrides Partial lobby payload to override default values.
 * @returns Fully populated mock lobby.
 */
function createMockLobby(
  overrides?: Partial<
    Prisma.LobbyGetPayload<{
      include: { owner: true; members: true; games: true };
    }>
  >,
) {
  const lobby: Prisma.LobbyGetPayload<{
    include: { owner: true; members: true; games: true };
  }> = {
    id: 'lobby1',
    name: 'Test Lobby',
    visibility: LobbyVisibility.PUBLIC,
    description: 'Test description',
    capacity: 10,
    ownerId: 'user1',
    owner: mockUser,
    members: overrides?.members || [],
    imageUrl: 'image_url',
    games: overrides?.games || [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  return lobby;
}

const mockLobby = createMockLobby();

/** A mock join request associated with the test lobby */
const mockJoinRequest: Prisma.LobbyJoinRequestGetPayload<{
  include: { user: true };
}> = {
  id: 'request1',
  userId: 'requester1',
  lobbyId: 'lobby1',
  status: RequestStatus.PENDING,
  createdAt: new Date(),
  user: {
    id: 'requester1',
    username: 'Requester',
    avatar: 'requester_avatar',
    steamId: 'steam_requester',
    role: UserRole.MEMBER,
    lobbyId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

/** A mock lobby member */
const mockMember: UserWithLobbyRelations = {
  ...mockUser,
  id: 'member1',
  lobbyId: 'lobby1',
  memberLobby: mockLobby,
};

/**
 * Creates a mocked Prisma client with stubbed methods for use in tests.
 * @returns Mocked PrismaService instance.
 */
function createMockPrismaClient(): jest.Mocked<PrismaService> {
  return {
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    lobby: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    lobbyJoinRequest: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  } as unknown as jest.Mocked<PrismaService>;
}
//#endregion

describe('LobbyService', () => {
  let service: LobbyService;
  let prismaService: jest.Mocked<PrismaService>;
  let lobbyGateway: jest.Mocked<LobbyGateway>;

  beforeEach(async () => {
    const mockPrisma = createMockPrismaClient();

    // Simulate Prisma transaction behavior
    (mockPrisma.$transaction as jest.Mock).mockImplementation(
      async (operations: Prisma.PrismaPromise<any>[]) => {
        const results: any[] = [];
        for (const operation of operations) {
          if ((operation as any)['where']?.id === 'requester1') {
            results.push({
              ...mockUser,
              id: 'requester1',
              lobbyId: 'lobby1',
            });
          } else if ((operation as any)['where']?.userId_lobbyId) {
            results.push(mockJoinRequest);
          }
        }
        return results;
      },
    );

    // Mock standard Prisma behavior for known edge cases
    (mockPrisma.user.findUnique as jest.Mock).mockImplementation(
      (args: any) => {
        if (args.where.id === 'nonexistent') return Promise.resolve(null);
        if (args.where.id === 'requester1') {
          return Promise.resolve({
            ...mockUser,
            id: 'requester1',
            lobbyId: null,
          });
        }
        return Promise.resolve(mockUser);
      },
    );

    // Fallback mocks
    (mockPrisma.user.update as jest.Mock).mockResolvedValue(mockUser);
    (mockPrisma.lobby.create as jest.Mock).mockResolvedValue(mockLobby);
    (mockPrisma.lobby.findUnique as jest.Mock).mockImplementation(
      (args: any) => {
        if (args.where.id === 'nonexistent') return Promise.resolve(null);
        if (args.where.id === 'full-lobby') {
          return Promise.resolve(
            createMockLobby({
              members: Array(10).fill(mockUser),
              capacity: 10,
            }),
          );
        }
        return Promise.resolve(
          createMockLobby({
            ownerId: args.where.id === 'lobby1' ? 'user1' : 'other-owner',
            members: [],
            capacity: 10,
          }),
        );
      },
    );

    (mockPrisma.lobbyJoinRequest.findFirst as jest.Mock).mockResolvedValue(
      null,
    );
    (mockPrisma.lobbyJoinRequest.findUnique as jest.Mock).mockImplementation(
      (args: any) => {
        if (
          args.where.userId_lobbyId?.userId === 'requester1' &&
          args.where.userId_lobbyId?.lobbyId === 'lobby1'
        ) {
          return Promise.resolve(mockJoinRequest);
        }
        return Promise.resolve(null);
      },
    );
    (mockPrisma.lobbyJoinRequest.findMany as jest.Mock).mockResolvedValue([
      mockJoinRequest,
    ]);
    (mockPrisma.lobbyJoinRequest.create as jest.Mock).mockImplementation(
      (args: any) => {
        return Promise.resolve({
          ...mockJoinRequest,
          userId: args.data.userId,
          lobbyId: args.data.lobbyId,
        });
      },
    );
    (mockPrisma.lobbyJoinRequest.delete as jest.Mock).mockResolvedValue(
      mockJoinRequest,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LobbyService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: UsersService,
          useValue: {
            getUserById: jest.fn().mockResolvedValue(mockUser),
          },
        },
        {
          provide: LobbyGateway,
          useValue: {
            isUserConnected: jest.fn().mockReturnValue(true),
            notifyNewMember: jest.fn(),
            notifyNewRequest: jest.fn(),
            notifyRequestCancelled: jest.fn(),
            notifyUserRequestUpdate: jest.fn(),
            notifyMemberLeft: jest.fn(),
            notifyVisibilityChange: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<LobbyService>(LobbyService);
    prismaService = module.get(PrismaService);
    lobbyGateway = module.get(LobbyGateway);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  //#region createJoinRequest
  describe('createJoinRequest', () => {
    it('should create join request successfully', async () => {
      const requester = { ...mockUser, id: 'requester1' };

      (
        prismaService.lobbyJoinRequest.findFirst as jest.Mock
      ).mockResolvedValueOnce(null);
      (
        prismaService.lobbyJoinRequest.findUnique as jest.Mock
      ).mockResolvedValueOnce(null);

      const result = await service.createJoinRequest('lobby1', requester);

      expect(result).toEqual({
        message: 'Your join request has been sent and is pending approval.',
      });
      expect(prismaService.lobbyJoinRequest.create).toHaveBeenCalledWith({
        data: { userId: 'requester1', lobbyId: 'lobby1' },
      });
      expect(lobbyGateway.notifyNewRequest).toHaveBeenCalledWith(
        'lobby1',
        'requester1',
        'TestUser',
      );
    });

    it('should throw if user already has pending request', async () => {
      const requester = { ...mockUser, id: 'requester1' };
      (
        prismaService.lobbyJoinRequest.findUnique as jest.Mock
      ).mockResolvedValueOnce(mockJoinRequest);

      await expect(
        service.createJoinRequest('lobby1', requester),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if user is already in a lobby', async () => {
      const requester = {
        ...mockUser,
        id: 'requester1',
        memberLobby: mockLobby,
      };
      await expect(
        service.createJoinRequest('lobby1', requester),
      ).rejects.toThrow(BadRequestException);
    });
  });
  //#endregion

  //#region approveJoinRequest
  describe('approveJoinRequest', () => {
    it('should approve request successfully', async () => {
      const owner = { ...mockUser, role: UserRole.OWNER, id: 'owner1' };

      (prismaService.lobby.findUnique as jest.Mock).mockResolvedValueOnce(
        createMockLobby({ ownerId: 'owner1', members: [] }),
      );

      const result = await service.approveJoinRequest(
        'lobby1',
        'requester1',
        owner,
      );

      expect(result).toEqual({ message: 'User has been added to the lobby' });
      expect(prismaService.$transaction).toHaveBeenCalled();
      expect(lobbyGateway.notifyUserRequestUpdate).toHaveBeenCalledWith(
        'requester1',
        'lobby1',
        'accepted',
      );
    });

    it('should throw if lobby is at capacity', async () => {
      const owner = { ...mockUser, role: UserRole.OWNER, id: 'owner1' };

      (prismaService.lobby.findUnique as jest.Mock).mockResolvedValueOnce(
        createMockLobby({
          ownerId: 'owner1',
          members: Array(10).fill(mockUser),
        }),
      );

      await expect(
        service.approveJoinRequest('lobby1', 'requester1', owner),
      ).rejects.toThrow(BadRequestException);
    });
  });
  //#endregion

  //#region removeMember
  describe('removeMember', () => {
    it('should remove member successfully', async () => {
      const owner = { ...mockUser, role: UserRole.OWNER, id: 'owner1' };
      const member = { ...mockMember, id: 'member1' };

      (prismaService.lobby.findUnique as jest.Mock).mockResolvedValueOnce(
        createMockLobby({ ownerId: 'owner1' }),
      );

      (prismaService.user.findUnique as jest.Mock).mockResolvedValueOnce(
        member,
      );

      const result = await service.removeMember('lobby1', 'member1', owner);

      expect(result).toEqual({
        message: 'Member has been removed from the lobby',
      });
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'member1' },
        data: { lobbyId: null, role: UserRole.MEMBER },
      });
      expect(lobbyGateway.notifyUserRequestUpdate).toHaveBeenCalledWith(
        'member1',
        'lobby1',
        'kicked',
      );
    });

    it('should throw if member not found', async () => {
      const owner = { ...mockUser, role: UserRole.OWNER };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        service.removeMember('lobby1', 'nonexistent', owner),
      ).rejects.toThrow(BadRequestException);
    });
  });
  //#endregion

  //#region createLobby
  describe('createLobby', () => {
    it('should create lobby successfully', async () => {
      const dto: CreateLobbyDto = {
        name: 'New Lobby',
        visibility: LobbyVisibility.PUBLIC,
        description: 'Test lobby description',
        imageUrl: 'test-image-url',
      };
      const user = { ...mockUser, memberLobby: null };

      (prismaService.lobby.create as jest.Mock).mockResolvedValueOnce({
        ...mockLobby,
        name: dto.name,
        visibility: dto.visibility,
        description: dto.description,
        imageUrl: dto.imageUrl || null,
      });

      const result = await service.createLobby(dto, user);

      expect(result).toEqual(
        expect.objectContaining({
          name: dto.name,
          visibility: dto.visibility,
          description: dto.description,
        }),
      );
    });

    it('should throw if user already in a lobby', async () => {
      const dto: CreateLobbyDto = {
        name: 'New Lobby',
        visibility: LobbyVisibility.PUBLIC,
        description: 'Test lobby description',
      };
      const user = { ...mockUser, memberLobby: mockLobby };

      await expect(service.createLobby(dto, user)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
  //#endregion
});
