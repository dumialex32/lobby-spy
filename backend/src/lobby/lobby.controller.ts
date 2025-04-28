import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CreateLobbyDto } from './dto/create-lobby.dto';
import { LobbyService } from './lobby.service';
import { IsLobbyOwnerGuard } from './guards/is-lobby-owner.guard';
import { AuthenticatedRequest } from 'src/auth/auth-request.interface';
import { UpdateLobbyVisibilityDto } from './dto/update-lobby-visibility.dto';

/**
 * Lobby Management Controller
 *
 * Handles all lobby-related operations including:
 * - Lobby creation and joining
 * - Lobby visibility management
 * - Lobby information retrieval
 *
 * All routes are protected by JWT authentication
 */
@Controller('lobby')
@UseGuards(JwtAuthGuard)
export class LobbyController {
  constructor(private readonly lobbyService: LobbyService) {}

  /**
   * Create a new lobby
   * @param dto - Lobby creation data (name, visibility, etc.)
   * @param req - Authenticated request containing user information
   * @returns The newly created lobby
   */
  @Post('create')
  createLobby(@Body() dto: CreateLobbyDto, @Req() req: AuthenticatedRequest) {
    return this.lobbyService.createLobby(dto, req.user);
  }

  /**
   * Join an existing lobby
   * @param lobbyId - ID of the lobby to join
   * @param req - Authenticated request containing user information
   * @returns Updated lobby information
   */
  @Post('join/:lobbyId')
  joinLobby(
    @Param('lobbyId') lobbyId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.lobbyService.joinLobby(lobbyId, req.user);
  }

  /**
   * Get the current user's active lobby
   * @param req - Authenticated request containing user information
   * @returns The user's current lobby (either owned or joined)
   */
  @Get('/myLobby')
  getMyLobby(@Req() req: AuthenticatedRequest) {
    return this.lobbyService.getMyLobby(req.user);
  }

  /**
   * Get lobby details by ID
   * @param lobbyId - ID of the lobby to retrieve
   * @param req - Authenticated request for permission verification
   * @returns Detailed lobby information
   */
  @Get('/:lobbyId')
  getLobby(
    @Param('lobbyId') lobbyId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.lobbyService.getLobby(lobbyId, req.user);
  }

  /**
   * Update lobby visibility (public/private)
   * @param lobbyId - ID of the lobby to modify
   * @param dto - Visibility update data
   * @param req - Authenticated request (must be lobby owner)
   * @returns Updated lobby information
   *
   * @protected Requires lobby ownership (enforced by IsLobbyOwnerGuard)
   */
  @Patch('/:lobbyId/visibility')
  @UseGuards(JwtAuthGuard, IsLobbyOwnerGuard)
  updateLobbyVisibility(
    @Param('lobbyId') lobbyId: string,
    @Body() dto: UpdateLobbyVisibilityDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.lobbyService.updateLobbyVisibility(
      lobbyId,
      req.user,
      dto.visibility,
    );
  }
}
