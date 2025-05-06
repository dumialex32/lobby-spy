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
import { WsExceptionFilter } from '../common/filters/ws-exception.filter';
import { LobbyService } from './lobby.service';

/**
 * Extends the Socket interface to include user information.
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
 * WebSocket Gateway for managing lobby-related events.
 * Handles connection, disconnection, and message events such as join requests,
 * request responses, and notifications.
 */
@WebSocketGateway({
  namespace: 'lobby', // Namespace for the WebSocket communication.
  cors: {
    origin:
      process.env.NODE_ENV === 'production' ? [process.env.FRONTEND_URL] : '*', // Configuring CORS based on environment.
    credentials: true,
  },
  transports: ['websocket'], // Only WebSocket transport is allowed.
})
@UseFilters(WsExceptionFilter) // Use the custom exception filter for handling WebSocket errors.
export class LobbyGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server!: Server; // WebSocket server instance.

  private readonly logger = new Logger(LobbyGateway.name); // Logger for this gateway.

  private readonly connectedUsers = new Map<string, Socket>(); // Map to store connected users by their ID.

  constructor(
    private readonly jwtService: JwtService, // JWT service for handling token validation.
    private readonly configService: ConfigService, // Configuration service for environment variables.
    @Inject(forwardRef(() => LobbyService)) // Inject LobbyService with forward reference.
    private readonly lobbyService: LobbyService,
  ) {}

  /**
   * Called after the gateway is initialized.
   * Sets up event listeners for WebSocket server.
   * @param server - The WebSocket server instance.
   */
  afterInit(server: Server): void {
    this.logger.log('Lobby WebSocket Gateway initialized');
    server.on('connection_error', (err: { message: string }) => {
      this.logger.error(`WebSocket connection error: ${err.message}`);
    });
  }

  /**
   * Handles user connection and authenticates using the JWT token.
   * Assigns the connected user to appropriate rooms based on their roles.
   * @param socket - The WebSocket connection instance.
   * @throws {WsException} If the user fails authentication or the token is missing.
   */
  async handleConnection(socket: AuthenticatedSocket): Promise<void> {
    try {
      const token = this.extractToken(socket); // Extract token from socket.
      const user = await this.jwtService.verifyAsync<{
        id: string;
        username: string;
        lobbyId?: string | null;
        memberLobbyId?: string | null;
      }>(token, {
        secret: this.configService.get<string>('JWT_SECRET'), // Verify the JWT token.
      });

      // Assign user data to the socket instance.
      socket.user = {
        id: user.id,
        username: user.username || 'Anonymous',
        lobbyId: user.lobbyId ?? null,
        memberLobbyId: user.memberLobbyId ?? null,
      };

      this.connectedUsers.set(user.id, socket); // Store the socket by user ID.

      // Join rooms based on the user's lobby ID and member lobby ID.
      await socket.join(`user-${user.id}`);
      if (user.lobbyId) await socket.join(`lobby-${user.lobbyId}`);
      if (user.memberLobbyId) await socket.join(`lobby-${user.memberLobbyId}`);

      this.logger.log(`Client connected: ${user.id}`);
    } catch (error) {
      this.logger.warn(
        `Authentication failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      socket.disconnect(true); // Disconnect the socket if authentication fails.
      if (error instanceof WsException) {
        throw error; // Explicitly throw the exception when missing token.
      } else {
        throw new WsException('Authentication error'); // Generic authentication error.
      }
    }
  }

  /**
   * Handles user disconnection and removes them from the connected users map.
   * @param socket - The WebSocket connection instance.
   */
  handleDisconnect(socket: AuthenticatedSocket): void {
    const userId = socket.user?.id;
    if (userId) {
      this.connectedUsers.delete(userId); // Remove user from connected users map.
      this.logger.log(`Client disconnected: ${userId}`);
    }
  }

  /**
   * Handles join requests from users and notifies the lobby owner.
   * @param socket - The WebSocket connection instance.
   * @param data - The data containing the join request information.
   * @throws {WsException} If the user is not a lobby owner.
   */
  @SubscribeMessage('join-request')
  @UsePipes(new ZodValidationPipe(joinRequestSchema)) // Validate incoming data with Zod.
  handleJoinRequest(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: JoinRequestDto,
  ): void {
    if (!socket.user.lobbyId) {
      throw new WsException('Only lobby owners can receive join requests');
    }
    this.notifyNewRequest(data.lobbyId, socket.user.id, socket.user.username); // Notify the lobby owner.
  }

  /**
   * Handles responses to join requests (accept or reject).
   * @param socket - The WebSocket connection instance.
   * @param data - The data containing the response to the join request.
   * @throws {WsException} If the user is not the lobby owner.
   */
  @SubscribeMessage('request-response')
  @UsePipes(new ZodValidationPipe(requestResponseSchema)) // Validate incoming data with Zod.
  handleRequestResponse(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: RequestResponseDto,
  ): void {
    if (socket.user.lobbyId !== data.lobbyId) {
      throw new WsException('Only lobby owner can respond to requests');
    }
    this.notifyUserRequestUpdate(data.userId, data.lobbyId, data.status); // Notify the user about the request response.
  }

  /**
   * Rejects a join request and notifies the user.
   * @param socket - The WebSocket connection instance.
   * @param data - The data containing the rejection details.
   * @throws {WsException} If the user is not the lobby owner.
   */
  @SubscribeMessage('reject-request')
  @UsePipes(new ZodValidationPipe(requestResponseSchema)) // Validate incoming data with Zod.
  handleRejectRequest(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: RequestResponseDto,
  ): void {
    if (socket.user.lobbyId !== data.lobbyId) {
      throw new WsException('Only lobby owner can respond to requests');
    }
    this.notifyUserRequestUpdate(data.userId, data.lobbyId, 'rejected'); // Notify the user about the rejection.
  }

  /**
   * Extracts the JWT token from the WebSocket connection.
   * @param socket - The WebSocket connection instance.
   * @returns The JWT token as a string.
   * @throws {WsException} If the token is missing.
   */
  private extractToken(socket: AuthenticatedSocket): string {
    const { token: authToken } = socket.handshake.auth; // Extract token from handshake auth.
    if (typeof authToken === 'string') return authToken;

    const authHeader = socket.handshake.headers['authorization']; // Extract token from authorization header.
    if (typeof authHeader === 'string') {
      const [, token] = authHeader.split(' ');
      if (token) return token;
    }

    throw new WsException('Missing authentication token'); // Throw exception if no token is found.
  }

  /**
   * Notifies the lobby about a new join request.
   * @param lobbyId - The lobby ID.
   * @param userId - The user ID of the requester.
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
   * Notifies the lobby about a cancelled join request.
   * @param lobbyId - The lobby ID.
   * @param userId - The user ID of the requester.
   */
  notifyRequestCancelled(lobbyId: string, userId: string): void {
    this.server.to(`lobby-${lobbyId}`).emit('request-cancelled', {
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Notifies a user about the status of their join request (accepted, rejected, or kicked).
   * @param userId - The user ID of the recipient.
   * @param lobbyId - The lobby ID.
   * @param status - The status of the request (accepted, rejected, kicked).
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
      ...(status === 'rejected' && { cooldown: '6h' }), // Add a cooldown for rejected requests.
    });
  }

  /**
   * Notifies the lobby about a new member joining.
   * @param lobbyId - The lobby ID.
   * @param userId - The user ID of the new member.
   * @param username - The username of the new member.
   */
  notifyNewMember(lobbyId: string, userId: string, username: string): void {
    this.server.to(`lobby-${lobbyId}`).emit('member-joined', {
      userId,
      username,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Notifies the lobby about a member leaving.
   * @param lobbyId - The lobby ID.
   * @param userId - The user ID of the member leaving.
   * @param username - The username of the member leaving.
   */
  notifyMemberLeft(lobbyId: string, userId: string, username: string): void {
    this.server.to(`lobby-${lobbyId}`).emit('member-left', {
      userId,
      username,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Notifies the lobby about a change in visibility (public or private).
   * @param lobbyId - The lobby ID.
   * @param visibility - The new visibility status of the lobby.
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
   * Checks if a user is currently connected to the WebSocket server.
   * @param userId - The user ID to check.
   * @returns A boolean indicating whether the user is connected.
   */
  isUserConnected(userId: string): boolean {
    return this.connectedUsers.has(userId); // Check if the user is in the connected users map.
  }
}
