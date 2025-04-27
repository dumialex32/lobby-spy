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

describe('LobbyController', () => {
  let controller: LobbyController;
  let lobbyService: LobbyService;

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

  const mockLobbyService = {
    createLobby: jest.fn(),
    joinLobby: jest.fn(),
    getMyLobby: jest.fn(),
    getLobby: jest.fn(),
    updateLobbyVisibility: jest.fn(),
  };

  const mockPrismaService = {};
  const mockUsersService = {};

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

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createLobby', () => {
    it('should call service with correct parameters', async () => {
      const dto: CreateLobbyDto = {
        name: 'Test Lobby',
        visibility: LobbyVisibility.PUBLIC,
        description: 'Test Description',
      };
      const req = { user: mockUser } as AuthenticatedRequest;

      mockLobbyService.createLobby.mockResolvedValue(mockLobby);
      const result = await controller.createLobby(dto, req);

      expect(result).toEqual(mockLobby);
      expect(lobbyService.createLobby).toHaveBeenCalledWith(dto, mockUser);
    });
  });

  describe('joinLobby', () => {
    it('should call service with correct parameters', async () => {
      const lobbyId = 'lobby-123';
      const req = { user: mockUser } as AuthenticatedRequest;
      const successMessage = { message: `Welcome to ${mockLobby.name}` };

      mockLobbyService.joinLobby.mockResolvedValue(successMessage);
      const result = await controller.joinLobby(lobbyId, req);

      expect(result).toEqual(successMessage);
      expect(lobbyService.joinLobby).toHaveBeenCalledWith(lobbyId, mockUser);
    });
  });

  describe('getMyLobby', () => {
    it('should call service with authenticated user', async () => {
      const req = { user: mockUser } as AuthenticatedRequest;

      mockLobbyService.getMyLobby.mockResolvedValue(mockLobby);
      const result = await controller.getMyLobby(req);

      expect(result).toEqual(mockLobby);
      expect(lobbyService.getMyLobby).toHaveBeenCalledWith(mockUser);
    });
  });

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
