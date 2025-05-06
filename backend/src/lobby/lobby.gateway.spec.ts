/**
 * @fileoverview
 * Unit tests for the LobbyGateway WebSocket class, testing authentication, connection handling,
 * join requests, request responses, disconnection behavior, and various WebSocket notification methods.
 *
 * Uses Jest with mocked services (JwtService, ConfigService, LobbyService) to isolate gateway behavior.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { WebSocketGateway, WsException } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { LobbyGateway } from './lobby.gateway';
import { LobbyService } from './lobby.service';
import { createMockUser } from '../common/utils/test-utils/mockUser';
import { Lobby } from '@prisma/client';
import { Handshake } from 'socket.io/dist/socket-types';

interface AuthenticatedSocket extends Socket {
  user: {
    id: string;
    username: string;
    lobbyId?: string | null;
    memberLobbyId?: string | null;
  };
}

// Base handshake used across all mocked sockets
const mockHandshake: Handshake = {
  auth: {},
  headers: {},
  time: new Date().toISOString(),
  address: '127.0.0.1',
  xdomain: false,
  secure: false,
  issued: 0,
  url: '/',
  query: {},
};

describe('LobbyGateway', () => {
  let gateway: LobbyGateway;
  let jwtService: JwtService;
  let configService: ConfigService;

  // Mock WebSocket server
  const mockServer = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
    on: jest.fn(),
  };

  /**
   * Creates a mock socket with optional overrides.
   * @param overrides Partial socket override properties.
   * @returns A mocked AuthenticatedSocket.
   */
  const createMockSocket = (
    overrides: Partial<AuthenticatedSocket> = {},
  ): AuthenticatedSocket =>
    ({
      id: 'test-socket-id',
      handshake: { ...mockHandshake, ...(overrides.handshake || {}) },
      disconnect: jest.fn(),
      join: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      ...overrides,
    }) as AuthenticatedSocket;

  // Mock dependencies
  const mockJwtService = { verifyAsync: jest.fn() };
  const mockConfigService = {
    get: jest
      .fn()
      .mockImplementation((key: string) =>
        key === 'JWT_SECRET' ? 'test-secret' : null,
      ),
  };
  const mockLobbyService = {};

  // Prepare module before each test
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LobbyGateway,
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: LobbyService, useValue: mockLobbyService },
      ],
    }).compile();

    gateway = module.get<LobbyGateway>(LobbyGateway);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
    gateway.server = mockServer as unknown as Server;
  });

  // Clear state between tests
  afterEach(() => {
    jest.clearAllMocks();
    gateway['connectedUsers'].clear();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('afterInit', () => {
    /**
     * Verifies the gateway initialization and connection error handler registration.
     */
    it('should initialize and set up error handler', () => {
      const loggerSpy = jest.spyOn(gateway['logger'], 'log');
      gateway.afterInit(mockServer as unknown as Server);

      expect(loggerSpy).toHaveBeenCalledWith(
        'Lobby WebSocket Gateway initialized',
      );
      expect(mockServer.on).toHaveBeenCalledWith(
        'connection_error',
        expect.any(Function),
      );
    });
  });

  describe('handleConnection', () => {
    /**
     * Tests successful authentication and room joining with a valid token.
     */
    it('should authenticate and setup socket with valid token', async () => {
      const user = createMockUser({
        id: 'user-1',
        username: 'testuser',
        lobbyId: 'lobby-1',
        memberLobby: { id: 'lobby-2' } as Lobby,
      });

      const testSocket = createMockSocket({
        handshake: { ...mockHandshake, auth: { token: 'valid-token' } },
      });

      mockJwtService.verifyAsync.mockResolvedValue({
        id: user.id,
        username: user.username,
        lobbyId: user.lobbyId,
        memberLobbyId: user.memberLobby?.id,
      });

      await gateway.handleConnection(testSocket);

      expect(testSocket.user).toEqual({
        id: user.id,
        username: user.username,
        lobbyId: user.lobbyId,
        memberLobbyId: user.memberLobby?.id,
      });
      expect(testSocket.join).toHaveBeenCalledTimes(3);
      expect(gateway['connectedUsers'].get(user.id)).toBe(testSocket);
    });

    /**
     * Tests that an invalid token results in a forced disconnect.
     */
    it('should handle authentication failure', async () => {
      const testSocket = createMockSocket({
        handshake: { ...mockHandshake, auth: { token: 'invalid-token' } },
      });

      mockJwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));
      await gateway.handleConnection(testSocket);
      expect(testSocket.disconnect).toHaveBeenCalledWith(true);
    });

    describe('edge cases', () => {
      it('should handle malformed JWT token', async () => {
        const testSocket = createMockSocket({
          handshake: { ...mockHandshake, auth: { token: 'malformed.token' } },
        });

        mockJwtService.verifyAsync.mockRejectedValue(
          new Error('Malformed token'),
        );
        await gateway.handleConnection(testSocket);
        expect(testSocket.disconnect).toHaveBeenCalled();
      });

      it('should handle expired JWT token', async () => {
        const testSocket = createMockSocket({
          handshake: { ...mockHandshake, auth: { token: 'expired.token' } },
        });

        mockJwtService.verifyAsync.mockRejectedValue(
          new Error('Token expired'),
        );
        await gateway.handleConnection(testSocket);
        expect(testSocket.disconnect).toHaveBeenCalled();
      });

      it('should log connection errors', async () => {
        const errorSpy = jest.spyOn(gateway['logger'], 'error');
        const testSocket = createMockSocket({
          handshake: { ...mockHandshake, auth: { token: 'bad-token' } },
        });

        mockJwtService.verifyAsync.mockRejectedValue(new Error('Invalid'));
        await gateway.handleConnection(testSocket);
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Invalid'),
        );
      });
    });
  });

  describe('Performance', () => {
    it('should handle 100 simultaneous connections', async () => {
      const sockets = Array(100)
        .fill(0)
        .map(() =>
          createMockSocket({
            handshake: { ...mockHandshake, auth: { token: 'valid-token' } },
          }),
        );

      mockJwtService.verifyAsync.mockResolvedValue({
        id: 'user',
        username: 'test',
        lobbyId: null,
        memberLobbyId: null,
      });

      await Promise.all(sockets.map((s) => gateway.handleConnection(s)));
      expect(gateway['connectedUsers'].size).toBe(100);
    });

    it('should efficiently handle multiple join requests', async () => {
      const testSocket = createMockSocket({
        user: { id: 'owner', username: 'test', lobbyId: 'lobby-1' },
      });

      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        gateway.handleJoinRequest(testSocket, { lobbyId: 'lobby-1' });
      }
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
      expect(mockServer.emit).toHaveBeenCalledTimes(100);
    });
  });

  describe('Security', () => {
    it('should reject connection without token', async () => {
      const testSocket = createMockSocket();
      await expect(gateway.handleConnection(testSocket)).rejects.toThrow(
        WsException,
      );
    });

    it('should prevent unauthorized room access', () => {
      const testSocket = createMockSocket({
        user: { id: 'user-1', username: 'test', lobbyId: null },
      });

      expect(() =>
        gateway.handleJoinRequest(testSocket, { lobbyId: 'private-lobby' }),
      ).toThrow(WsException);
    });

    it('should not expose sensitive information in error messages', async () => {
      const testSocket = createMockSocket({
        handshake: { ...mockHandshake, auth: { token: 'invalid' } },
      });

      mockJwtService.verifyAsync.mockRejectedValue(
        new Error('DB password is 1234'),
      );
      await gateway.handleConnection(testSocket);

      const emittedError = ((testSocket.emit as jest.Mock).mock.calls.find(
        ([event]) => event === 'exception',
      ) || [])[1];
      expect(emittedError.message).not.toContain('DB password');
      expect(emittedError.message).toBe('Internal WebSocket error');
    });
  });

  describe('handleDisconnect', () => {
    it('should remove user from connected users', () => {
      const testSocket = createMockSocket({
        user: { id: 'user-1', username: 'testuser' },
      });

      gateway['connectedUsers'].set('user-1', testSocket);
      gateway.handleDisconnect(testSocket);
      expect(gateway['connectedUsers'].has('user-1')).toBe(false);
    });

    it('should handle disconnect when user is not set', () => {
      const testSocket = createMockSocket();
      expect(() => gateway.handleDisconnect(testSocket)).not.toThrow();
    });
  });

  describe('join-request handler', () => {
    it('should notify lobby owner of join request', () => {
      const testSocket = createMockSocket({
        user: { id: 'user-1', username: 'testuser', lobbyId: 'lobby-1' },
      });

      gateway.handleJoinRequest(testSocket, { lobbyId: 'lobby-1' });

      expect(mockServer.to).toHaveBeenCalledWith('lobby-lobby-1');
      expect(mockServer.emit).toHaveBeenCalledWith('join-request', {
        userId: 'user-1',
        username: 'testuser',
        timestamp: expect.any(String),
      });
    });

    it('should throw if user is not a lobby owner', () => {
      const testSocket = createMockSocket({
        user: { id: 'user-1', username: 'testuser', lobbyId: null },
      });

      expect(() =>
        gateway.handleJoinRequest(testSocket, { lobbyId: 'lobby-1' }),
      ).toThrow(WsException);
    });

    describe('Type Safety', () => {
      it('should enforce correct message payload types', () => {
        const testSocket = createMockSocket({
          user: { id: 'owner', username: 'test', lobbyId: 'lobby-1' },
        });

        expect(() =>
          gateway.handleJoinRequest(testSocket, { invalid: 'data' } as any),
        ).toThrow();
      });
    });
  });

  describe('request-response handler', () => {
    it('should notify user of request approval', () => {
      const testSocket = createMockSocket({
        user: { id: 'owner-1', username: 'owner', lobbyId: 'lobby-1' },
      });

      gateway.handleRequestResponse(testSocket, {
        lobbyId: 'lobby-1',
        userId: 'user-1',
        status: 'accepted',
      });

      expect(mockServer.to).toHaveBeenCalledWith('user-user-1');
      expect(mockServer.emit).toHaveBeenCalledWith('request-updated', {
        lobbyId: 'lobby-1',
        status: 'accepted',
        timestamp: expect.any(String),
      });
    });

    it('should throw if user is not the lobby owner', () => {
      const testSocket = createMockSocket({
        user: { id: 'user-1', username: 'testuser', lobbyId: 'other-lobby' },
      });

      expect(() =>
        gateway.handleRequestResponse(testSocket, {
          lobbyId: 'lobby-1',
          userId: 'user-1',
          status: 'accepted',
        }),
      ).toThrow(WsException);
    });
  });

  describe('reject-request handler', () => {
    it('should notify user with cooldown when rejected', () => {
      const testSocket = createMockSocket({
        user: { id: 'owner-1', username: 'owner', lobbyId: 'lobby-1' },
      });

      gateway.handleRejectRequest(testSocket, {
        lobbyId: 'lobby-1',
        userId: 'user-1',
        status: 'rejected',
      });

      expect(mockServer.emit).toHaveBeenCalledWith('request-updated', {
        lobbyId: 'lobby-1',
        status: 'rejected',
        timestamp: expect.any(String),
        cooldown: '6h',
      });
    });
  });

  describe('notification methods', () => {
    beforeEach(() => jest.clearAllMocks());

    test('notifyNewRequest', () => {
      gateway.notifyNewRequest('lobby-1', 'user-1', 'testuser');
      expect(mockServer.emit).toHaveBeenCalledWith('join-request', {
        userId: 'user-1',
        username: 'testuser',
        timestamp: expect.any(String),
      });
    });

    test('notifyRequestCancelled', () => {
      gateway.notifyRequestCancelled('lobby-1', 'user-1');
      expect(mockServer.emit).toHaveBeenCalledWith('request-cancelled', {
        userId: 'user-1',
        timestamp: expect.any(String),
      });
    });

    test('notifyNewMember', () => {
      gateway.notifyNewMember('lobby-1', 'user-1', 'newuser');
      expect(mockServer.emit).toHaveBeenCalledWith('member-joined', {
        userId: 'user-1',
        username: 'newuser',
        timestamp: expect.any(String),
      });
    });

    test('notifyMemberLeft', () => {
      gateway.notifyMemberLeft('lobby-1', 'user-1', 'leavinguser');
      expect(mockServer.emit).toHaveBeenCalledWith('member-left', {
        userId: 'user-1',
        username: 'leavinguser',
        timestamp: expect.any(String),
      });
    });

    test('notifyVisibilityChange', () => {
      gateway.notifyVisibilityChange('lobby-1', 'PRIVATE');
      expect(mockServer.emit).toHaveBeenCalledWith('visibility-changed', {
        visibility: 'PRIVATE',
        timestamp: expect.any(String),
      });
    });
  });

  describe('isUserConnected', () => {
    it('should return connection status correctly', () => {
      const testSocket = createMockSocket({
        user: { id: 'user-1', username: 'testuser' },
      });

      gateway['connectedUsers'].set('user-1', testSocket);
      expect(gateway.isUserConnected('user-1')).toBe(true);
      expect(gateway.isUserConnected('nonexistent')).toBe(false);
    });
  });
});
