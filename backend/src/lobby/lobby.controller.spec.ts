import { Test, TestingModule } from '@nestjs/testing';
import { LobbyController } from './lobby.controller';
import { LobbyService } from './lobby.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { IsLobbyOwnerGuard } from './guards/is-lobby-owner.guard';
import { AuthenticatedRequest } from 'src/auth/auth-request.interface';
import { LobbyVisibility } from '@prisma/client';
import { CreateLobbyDto } from './dto/create-lobby.dto';
import { UpdateLobbyVisibilityDto } from './dto/update-lobby-visibility.dto';

describe('LobbyController', () => {
  let controller: LobbyController;

  const mockLobbyService: Partial<Record<keyof LobbyService, jest.Mock>> = {
    createLobby: jest.fn((dto: CreateLobbyDto, steamId: string) =>
      Promise.resolve({
        id: '1',
        ...dto,
        ownerSteamId: steamId,
      }),
    ),
    joinLobby: jest.fn((lobbyId: string, steamId: string) =>
      Promise.resolve({
        message: 'Successfully joined the lobby',
        lobbyId,
        steamId,
      }),
    ),
    getMyLobby: jest.fn((steamId: string) =>
      Promise.resolve({
        id: '1',
        ownerSteamId: steamId,
        name: 'Test Lobby',
      }),
    ),
    getLobby: jest.fn((lobbyId: string, steamId: string) =>
      Promise.resolve({
        id: lobbyId,
        steamId,
        name: 'Public Lobby',
        visibility: LobbyVisibility.PUBLIC,
      }),
    ),
    updateLobbyVisibility: jest.fn(
      (lobbyId: string, steamId: string, visibility: LobbyVisibility) =>
        Promise.resolve({
          id: lobbyId,
          ownerSteamId: steamId,
          visibility,
        }),
    ),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LobbyController],
      providers: [
        { provide: LobbyService, useValue: mockLobbyService },
        { provide: PrismaService, useValue: {} },
        {
          provide: IsLobbyOwnerGuard,
          useValue: { canActivate: jest.fn(() => true) },
        },
      ],
    }).compile();

    controller = module.get<LobbyController>(LobbyController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createLobby', () => {
    it('should call lobbyService.createLobby with correct arguments', async () => {
      const dto: CreateLobbyDto = {
        name: 'Test Lobby',
        visibility: LobbyVisibility.PUBLIC,
        description: 'A nice lobby',
      };
      const req = { user: { steamId: '12345' } } as AuthenticatedRequest;

      const result = await controller.createLobby(dto, req);

      expect(mockLobbyService.createLobby).toHaveBeenCalledWith(dto, '12345');
      expect(result).toEqual({
        id: '1',
        ...dto,
        ownerSteamId: '12345',
      });
    });
  });

  describe('joinLobby', () => {
    it('should call lobbyService.joinLobby with correct arguments', async () => {
      const lobbyId = '1';
      const req = { user: { steamId: '12345' } } as AuthenticatedRequest;

      const result = await controller.joinLobby(lobbyId, req);

      expect(mockLobbyService.joinLobby).toHaveBeenCalledWith(lobbyId, '12345');
      expect(result).toEqual({
        message: 'Successfully joined the lobby',
        lobbyId,
        steamId: '12345',
      });
    });
  });

  describe('getMyLobby', () => {
    it("should return the user's lobby", async () => {
      const req = { user: { steamId: '12345' } } as AuthenticatedRequest;

      const result = await controller.getMyLobby(req);

      expect(mockLobbyService.getMyLobby).toHaveBeenCalledWith('12345');
      expect(result).toEqual({
        id: '1',
        ownerSteamId: '12345',
        name: 'Test Lobby',
      });
    });
  });

  describe('getLobby', () => {
    it('should return the specified lobby', async () => {
      const lobbyId = '1';
      const req = { user: { steamId: '12345' } } as AuthenticatedRequest;

      const result = await controller.getLobby(lobbyId, req);

      expect(mockLobbyService.getLobby).toHaveBeenCalledWith(lobbyId, '12345');
      expect(result).toEqual({
        id: '1',
        steamId: '12345',
        name: 'Public Lobby',
        visibility: LobbyVisibility.PUBLIC,
      });
    });
  });

  describe('updateLobbyVisibility', () => {
    it('should update the visibility of a lobby', async () => {
      const lobbyId = '1';
      const req = { user: { steamId: '12345' } } as AuthenticatedRequest;
      const dto: UpdateLobbyVisibilityDto = {
        visibility: LobbyVisibility.PRIVATE,
      };

      const result = await controller.updateLobbyVisibility(lobbyId, dto, req);

      expect(mockLobbyService.updateLobbyVisibility).toHaveBeenCalledWith(
        lobbyId,
        '12345',
        LobbyVisibility.PRIVATE,
      );

      expect(result).toEqual({
        id: '1',
        ownerSteamId: '12345',
        visibility: LobbyVisibility.PRIVATE,
      });
    });
  });
});
