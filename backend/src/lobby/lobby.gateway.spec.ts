import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { LobbyGateway } from './lobby.gateway';
import { LobbyService } from './lobby.service';
import { WsException } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Handshake } from 'socket.io/dist/socket-types';

// Interface to define a socket with user authentication details
interface AuthenticatedSocket extends Socket {
  user: {
    id: string;
    username: string;
    lobbyId?: string | null;
    memberLobbyId?: string | null;
  };
}

// Mock constants for JWT secret, user, and lobby details
const MOCK_JWT_SECRET = 'test-secret';
const MOCK_LOBBY_ID = 'lobby-1';
const MOCK_USER_ID = 'user-1';

// Mock Handshake object, which represents information about the connection
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

// Helper function to create a mock socket with customizable overrides
const createMockSocket = (
  overrides: Partial<AuthenticatedSocket> = {},
): AuthenticatedSocket =>
  ({
    id: 'socket-1',
    handshake: { ...mockHandshake, ...(overrides.handshake || {}) },
    disconnect: jest.fn(),
    join: jest.fn().mockResolvedValue(undefined),
    emit: jest.fn(),
    ...overrides,
  }) as AuthenticatedSocket;

describe('LobbyGateway', () => {
  let gateway: LobbyGateway;
  let jwtService: JwtService;

  // Mock Server object to simulate WebSocket server behavior
  const mockServer = {
    to: jest.fn().mockReturnValue({
      emit: jest.fn(),
    }),
    on: jest.fn(),
  };

  // Setup the testing module and mock dependencies before tests
  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LobbyGateway,
        {
          provide: JwtService,
          useValue: {
            verifyAsync: jest.fn().mockResolvedValue({
              id: MOCK_USER_ID,
              username: 'testuser',
            }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'JWT_SECRET' ? MOCK_JWT_SECRET : null,
            ),
          },
        },
        {
          provide: LobbyService,
          useValue: {},
        },
      ],
    }).compile();

    // Retrieve the instances of gateway and services
    gateway = module.get<LobbyGateway>(LobbyGateway);
    jwtService = module.get<JwtService>(JwtService);

    // Mock the server for emitting events
    gateway['server'] = mockServer as unknown as Server;
  });

  // Reset mocks and connected users before each test
  beforeEach(() => {
    jest.clearAllMocks();
    gateway['connectedUsers'].clear();
  });

  // Test case for `afterInit` method to check server event listener attachment
  describe('afterInit', () => {
    it('should attach connection_error listener', () => {
      gateway.afterInit(mockServer as unknown as Server);
      expect(mockServer.on).toHaveBeenCalledWith(
        'connection_error',
        expect.any(Function),
      );
    });
  });

  // Test cases for `handleConnection` method
  describe('handleConnection', () => {
    it('should authenticate and assign user', async () => {
      // Simulate a socket with valid authentication token
      const socket = createMockSocket({
        handshake: { ...mockHandshake, auth: { token: 'valid' } },
      });

      await gateway.handleConnection(socket);

      // Verify the user is assigned to the correct room
      expect(socket.join).toHaveBeenCalledWith(`user-${MOCK_USER_ID}`);
      expect(gateway['connectedUsers'].has(MOCK_USER_ID)).toBe(true);
    });

    it('should handle lobbyId and memberLobbyId', async () => {
      // Simulate successful JWT verification with additional lobby info
      (jwtService.verifyAsync as jest.Mock).mockResolvedValueOnce({
        id: MOCK_USER_ID,
        username: 'testuser',
        lobbyId: MOCK_LOBBY_ID,
        memberLobbyId: 'lobby-2',
      });

      const socket = createMockSocket({
        handshake: { ...mockHandshake, auth: { token: 'valid' } },
      });

      await gateway.handleConnection(socket);

      // Ensure the user joins the correct lobbies
      expect(socket.join).toHaveBeenCalledWith(`lobby-${MOCK_LOBBY_ID}`);
      expect(socket.join).toHaveBeenCalledWith(`lobby-lobby-2`);
    });

    it('should throw on missing token', async () => {
      // Simulate a socket with no token
      const socket = createMockSocket();

      await expect(gateway.handleConnection(socket)).rejects.toThrow(
        new WsException('Missing authentication token'),
      );
    });

    it('should disconnect on error', async () => {
      // Simulate a socket with an invalid token
      const socket = createMockSocket({
        handshake: { ...mockHandshake, auth: { token: 'bad-token' } },
      });

      // Mock invalid token error
      (jwtService.verifyAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Invalid token'),
      );

      // Verify that connection is closed
      await expect(gateway.handleConnection(socket)).rejects.toThrowError(
        new WsException('Authentication error'),
      );

      expect(socket.disconnect).toHaveBeenCalledWith(true); // Check that disconnect was called
    });
  });

  // Test cases for message handling methods like join request, response, etc.
  describe('Message Handling', () => {
    it('should emit join-request for lobby owners', () => {
      const socket = createMockSocket({
        user: {
          id: MOCK_USER_ID,
          username: 'user',
          lobbyId: MOCK_LOBBY_ID,
        },
      });

      gateway.handleJoinRequest(socket, { lobbyId: MOCK_LOBBY_ID });

      // Verify that the server emits a join request to the correct lobby
      expect(mockServer.to).toHaveBeenCalledWith(`lobby-${MOCK_LOBBY_ID}`);
    });

    it('should throw if non-owner handles join-request', () => {
      const socket = createMockSocket({
        user: {
          id: MOCK_USER_ID,
          username: 'user',
        },
      });

      // Non-owners should not be able to handle join requests
      expect(() =>
        gateway.handleJoinRequest(socket, { lobbyId: MOCK_LOBBY_ID }),
      ).toThrow(WsException);
    });

    it('should emit request-updated with accepted status', () => {
      const socket = createMockSocket({
        user: {
          id: 'owner',
          username: 'owner',
          lobbyId: MOCK_LOBBY_ID,
        },
      });

      gateway.handleRequestResponse(socket, {
        userId: MOCK_USER_ID,
        lobbyId: MOCK_LOBBY_ID,
        status: 'accepted',
      });

      // Verify that the server emits a request update with accepted status
      expect(mockServer.to).toHaveBeenCalledWith(`user-${MOCK_USER_ID}`);
    });

    it('should emit request-updated with rejected status', () => {
      const socket = createMockSocket({
        user: {
          id: 'owner',
          username: 'owner',
          lobbyId: MOCK_LOBBY_ID,
        },
      });

      gateway.handleRejectRequest(socket, {
        userId: MOCK_USER_ID,
        lobbyId: MOCK_LOBBY_ID,
        status: 'rejected',
      });

      // Verify that the server emits a request update with rejected status
      expect(mockServer.to).toHaveBeenCalledWith(`user-${MOCK_USER_ID}`);
    });
  });

  // Test cases for notification methods
  describe('Notifications', () => {
    it('should notify member joined', () => {
      gateway.notifyNewMember(MOCK_LOBBY_ID, MOCK_USER_ID, 'user');
      // Verify that the server emits a 'member-joined' event
      expect(mockServer.to().emit).toHaveBeenCalledWith(
        'member-joined',
        expect.any(Object),
      );
    });

    it('should notify member left', () => {
      gateway.notifyMemberLeft(MOCK_LOBBY_ID, MOCK_USER_ID, 'user');
      // Verify that the server emits a 'member-left' event
      expect(mockServer.to().emit).toHaveBeenCalledWith(
        'member-left',
        expect.any(Object),
      );
    });

    it('should notify visibility changed', () => {
      gateway.notifyVisibilityChange(MOCK_LOBBY_ID, 'PUBLIC');
      // Verify that the server emits a 'visibility-changed' event
      expect(mockServer.to().emit).toHaveBeenCalledWith(
        'visibility-changed',
        expect.any(Object),
      );
    });

    it('should notify request cancelled', () => {
      gateway.notifyRequestCancelled(MOCK_LOBBY_ID, MOCK_USER_ID);
      // Verify that the server emits a 'request-cancelled' event
      expect(mockServer.to().emit).toHaveBeenCalledWith(
        'request-cancelled',
        expect.any(Object),
      );
    });
  });

  // Test cases for checking if a user is connected
  describe('isUserConnected', () => {
    it('should return true for connected user', () => {
      const socket = createMockSocket();
      gateway['connectedUsers'].set(MOCK_USER_ID, socket);
      // Check if the user is marked as connected
      expect(gateway.isUserConnected(MOCK_USER_ID)).toBe(true);
    });

    it('should return false for unknown user', () => {
      // Check that an unknown user is not connected
      expect(gateway.isUserConnected('unknown')).toBe(false);
    });
  });
});
