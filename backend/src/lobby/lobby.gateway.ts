/**
 * WebSocket Gateway for Lobby Management
 *
 * Handles real-time communication for lobby operations including:
 * - User connections/disconnections
 * - Join requests and approvals
 * - Lobby member notifications
 * - Visibility changes
 *
 * All WebSocket communications are authenticated using JWT tokens.
 */
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
import {
  Logger,
  UseFilters,
  UsePipes,
  Inject,
  forwardRef,
} from '@nestjs/common';
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
import { LobbyService } from './lobby.service';

/**
 * Extended Socket interface with authenticated user data
 */
interface AuthenticatedSocket extends Socket {
  user: {
    id: string; // User ID from database
    lobbyId?: string | null; // ID of lobby user owns (if any)
    memberLobbyId?: string | null; // ID of lobby user is member of (if any)
    username: string; // User's display name (fallback to 'Anonymous')
  };
}

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

  /**
   * Map to track connected users by their ID
   * Key: user ID
   * Value: Socket instance
   */
  private connectedUsers = new Map<string, Socket>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => LobbyService))
    private readonly lobbyService: LobbyService,
  ) {}

  /**
   * Called after WebSocket server initialization
   * @param server - The initialized Socket.IO server instance
   */
  afterInit(server: Server): void {
    this.logger.log('Lobby WebSocket Gateway initialized');
    server.on('connection_error', (err: { message: string }) => {
      this.logger.error(`WebSocket connection error: ${err.message}`);
    });
  }

  /**
   * Handles new client connections
   * - Authenticates user via JWT
   * - Sets up user data on socket
   * - Joins relevant rooms
   * @param socket - The connected WebSocket client
   * @throws Disconnects socket if authentication fails
   */
  async handleConnection(socket: AuthenticatedSocket): Promise<void> {
    try {
      const token = this.extractToken(socket);
      const user = await this.jwtService.verifyAsync<
        User & { lobbyId?: string; memberLobbyId?: string }
      >(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      // Attach user data to socket
      socket.user = {
        id: user.id,
        username: user.username || 'Anonymous',
        lobbyId: user.lobbyId ?? null,
        memberLobbyId: user.memberLobbyId ?? null,
      };

      // Track connected user
      this.connectedUsers.set(user.id, socket);

      // Join user-specific room
      await socket.join(`user-${user.id}`);

      // Join lobby rooms if applicable
      if (user.lobbyId) await socket.join(`lobby-${user.lobbyId}`);
      if (user.memberLobbyId) await socket.join(`lobby-${user.memberLobbyId}`);

      this.logger.log(`Client connected: ${user.id}`);
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.warn(`Authentication failed: ${error.message}`);
      socket.disconnect(true);
    }
  }

  /**
   * Handles client disconnections
   * @param socket - The disconnected WebSocket client
   */
  handleDisconnect(socket: AuthenticatedSocket): void {
    if (socket.user?.id) {
      this.connectedUsers.delete(socket.user.id);
      this.logger.log(`Client disconnected: ${socket.user.id}`);
    }
  }

  /**
   * Handles join request messages
   * @param socket - The requesting client's socket
   * @param data - Join request payload
   * @throws WsException if user is not a lobby owner
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
   * Handles request approval responses
   * @param socket - The responding client's socket
   * @param data - Response payload
   * @throws WsException if user is not the lobby owner
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
   * Handles request rejection messages
   * @param socket - The responding client's socket
   * @param data - Rejection payload
   * @throws WsException if user is not the lobby owner
   */
  @SubscribeMessage('reject-request')
  @UsePipes(new ZodValidationPipe(requestResponseSchema))
  handleRejectRequest(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: RequestResponseDto,
  ): void {
    if (socket.user.lobbyId !== data.lobbyId) {
      throw new WsException('Only lobby owner can respond to requests');
    }
    this.notifyUserRequestUpdate(data.userId, data.lobbyId, 'rejected');
  }

  /**
   * Extracts JWT token from socket connection
   * @param socket - The connected socket
   * @returns The extracted token
   * @throws WsException if no token found
   */
  private extractToken(socket: AuthenticatedSocket): string {
    // Check handshake auth first
    const { token: handshakeToken } = socket.handshake.auth;
    if (handshakeToken && typeof handshakeToken === 'string') {
      return handshakeToken;
    }

    // Fallback to Authorization header
    const authHeader = socket.handshake.headers['authorization'];
    if (typeof authHeader === 'string') {
      const token = authHeader.split(' ')[1];
      if (token) {
        return token;
      }
    }

    throw new WsException('Missing authentication token');
  }

  /* ========== Notification Methods ========== */

  /**
   * Notifies lobby owner of new join request
   * @param lobbyId - Target lobby ID
   * @param userId - Requesting user ID
   * @param username - Requesting user's display name
   */
  notifyNewRequest(lobbyId: string, userId: string, username: string): void {
    this.server.to(`lobby-${lobbyId}`).emit('join-request', {
      userId,
      username,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Notifies cancel request by the user
   */

  notifyRequestCancelled(lobbyId: string, userId: string): void {
    this.server.to(`lobby-${lobbyId}`).emit('request-cancelled', {
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Notifies user of their request status update
   * @param userId - Target user ID
   * @param lobbyId - Relevant lobby ID
   * @param status - Update status (accepted/rejected/kicked)
   */
  notifyUserRequestUpdate(
    userId: string,
    lobbyId: string,
    status: 'accepted' | 'rejected' | 'kicked',
  ): void {
    this.server.to(`user-${userId}`).emit('request-updated', {
      lobbyId,
      status,
      timestamp: new Date().toISOString(),
      ...(status === 'rejected' && { cooldown: '6h' }), // Add cooldown for rejections
    });
  }

  /**
   * Notifies lobby of new member
   * @param lobbyId - Target lobby ID
   * @param userId - New member's user ID
   * @param username - New member's display name
   */
  notifyNewMember(lobbyId: string, userId: string, username: string): void {
    this.server.to(`lobby-${lobbyId}`).emit('member-joined', {
      userId,
      username,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Notifies lobby of member departure
   * @param lobbyId - Target lobby ID
   * @param userId - Departing user ID
   * @param username - Departing user's display name
   */
  notifyMemberLeft(lobbyId: string, userId: string, username: string): void {
    this.server.to(`lobby-${lobbyId}`).emit('member-left', {
      userId,
      username,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Notifies lobby of visibility change
   * @param lobbyId - Target lobby ID
   * @param visibility - New visibility setting
   */
  notifyVisibilityChange(
    lobbyId: string,
    visibility: 'PUBLIC' | 'PRIVATE',
  ): void {
    this.server.to(`lobby-${lobbyId}`).emit('visibility-changed', {
      visibility,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Checks if a user is currently connected via WebSocket
   * @param userId - User ID to check
   * @returns True if user is connected, false otherwise
   */
  isUserConnected(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }
}
