import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Logger, UseFilters, UsePipes } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  JoinRequestDto,
  joinRequestSchema,
  RequestResponseDto,
  requestResponseSchema,
} from './dto/websocket.dto';
import { User } from '@prisma/client';
import { WsExceptionFilter } from '../common/filters/ws-exception.filter';

/**
 * Extends Socket.io's Socket with authenticated user data.
 */
interface AuthenticatedSocket extends Socket {
  user: {
    id: string;
    lobbyId?: string | null;
    memberLobbyId?: string | null;
    username: string;
  };
}

/**
 * Handles WebSocket communication for the 'lobby' namespace.
 * Supports user authentication, join requests, and request approvals.
 */
@WebSocketGateway({
  namespace: 'lobby',
  cors: {
    origin:
      process.env.NODE_ENV === 'production' ? [process.env.FRONTEND_URL] : '*',
    credentials: true,
  },
  transports: ['websocket'],
})
@UseFilters(WsExceptionFilter)
export class LobbyGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private logger = new Logger(LobbyGateway.name);

  /** Keeps track of connected users by their user ID. */
  private connectedUsers = new Map<string, Socket>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Called once the WebSocket server is initialized.
   * @param server - The initialized Socket.IO server instance.
   */
  afterInit(server: Server): void {
    this.logger.log('Lobby WebSocket Gateway initialized');
    server.on('connection_error', (err: { message: string }) => {
      this.logger.error(`WebSocket connection error: ${err.message}`);
    });
  }

  /**
   * Handles new client connections and authenticates the user.
   * @param socket - The connected WebSocket client.
   */
  async handleConnection(socket: AuthenticatedSocket): Promise<void> {
    try {
      const token = this.extractToken(socket);
      const user = await this.jwtService.verifyAsync<
        User & { lobbyId?: string; memberLobbyId?: string }
      >(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      socket.user = {
        id: user.id,
        username: user.username || 'Anonymous',
        lobbyId: user.lobbyId ?? null,
        memberLobbyId: user.memberLobbyId ?? null,
      };

      this.connectedUsers.set(user.id, socket);

      void socket.join(`user-${user.id}`);
      if (user.lobbyId) void socket.join(`lobby-${user.lobbyId}`);
      if (user.memberLobbyId) void socket.join(`lobby-${user.memberLobbyId}`);

      this.logger.log(`Client connected: ${user.id}`);
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.warn(`Authentication failed: ${error.message}`);
      socket.disconnect(true);
    }
  }

  /**
   * Handles client disconnection and cleans up user data.
   * @param socket - The disconnected WebSocket client.
   */
  handleDisconnect(socket: AuthenticatedSocket): void {
    if (socket.user?.id) {
      this.connectedUsers.delete(socket.user.id);
      this.logger.log(`Client disconnected: ${socket.user.id}`);
    }
  }

  /**
   * Handles a 'join-request' event from a client.
   * Only lobby owners are allowed to receive join requests.
   * @param socket - The WebSocket client.
   * @param data - The join request payload.
   */
  @SubscribeMessage('join-request')
  @UsePipes(new ZodValidationPipe(joinRequestSchema))
  handleJoinRequest(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: JoinRequestDto,
  ): void {
    if (!socket.user.lobbyId) {
      throw new WsException('Only lobby owners can receive join requests');
    }
    this.notifyNewRequest(data.lobbyId, socket.user.id, socket.user.username);
  }

  /**
   * Handles a 'request-response' event for accepting/rejecting join requests.
   * Only the lobby owner can respond.
   * @param socket - The WebSocket client.
   * @param data - The response payload.
   */
  @SubscribeMessage('request-response')
  @UsePipes(new ZodValidationPipe(requestResponseSchema))
  handleRequestResponse(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: RequestResponseDto,
  ): void {
    if (socket.user.lobbyId !== data.lobbyId) {
      throw new WsException('Only lobby owner can respond to requests');
    }
    this.notifyUserRequestUpdate(data.userId, data.lobbyId, data.status);
  }

  /**
   * Extracts the JWT token from the WebSocket connection handshake.
   * @param socket - The WebSocket client.
   * @returns The extracted token.
   * @throws WsException if no token is found.
   */
  private extractToken(socket: AuthenticatedSocket): string {
    const { token: handshakeToken } = socket.handshake.auth;
    if (handshakeToken && typeof handshakeToken === 'string') {
      return handshakeToken;
    }

    const authHeader = socket.handshake.headers['authorization'];
    if (typeof authHeader === 'string') {
      const token = authHeader.split(' ')[1];
      if (token) {
        return token;
      }
    }

    throw new WsException('Missing authentication token');
  }

  /**
   * Emits a 'join-request' event to all sockets in a lobby.
   * @param lobbyId - The ID of the lobby.
   * @param userId - The ID of the user requesting to join.
   * @param username - The username of the requester.
   */
  notifyNewRequest(lobbyId: string, userId: string, username: string): void {
    this.server.to(`lobby-${lobbyId}`).emit('join-request', {
      userId,
      username,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emits a 'request-updated' event to the user whose request was handled.
   * @param userId - The user ID of the requester.
   * @param lobbyId - The lobby involved.
   * @param status - The response status ('accepted' or 'rejected').
   */
  notifyUserRequestUpdate(
    userId: string,
    lobbyId: string,
    status: 'accepted' | 'rejected',
  ): void {
    this.server.to(`user-${userId}`).emit('request-updated', {
      lobbyId,
      status,
      timestamp: new Date().toISOString(),
      ...(status === 'rejected' && { cooldown: '6h' }),
    });
  }

  /**
   * Checks if a user is currently connected via WebSocket.
   * @param userId - The user ID to check.
   * @returns True if the user is connected, false otherwise.
   */
  isUserConnected(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }
}
