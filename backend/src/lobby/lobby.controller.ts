import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  Delete,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CreateLobbyDto } from './dto/create-lobby.dto';
import { LobbyService } from './lobby.service';
import { IsLobbyOwnerGuard } from './guards/is-lobby-owner.guard';
import { AuthenticatedRequest } from 'src/auth/auth-request.interface';
import { UpdateLobbyVisibilityDto } from './dto/update-lobby-visibility.dto';

@Controller('lobby')
@UseGuards(JwtAuthGuard) // Applies JWT authentication guard to all routes
export class LobbyController {
  constructor(private readonly lobbyService: LobbyService) {}

  /**
   * Creates a new lobby for the authenticated user.
   */
  @Post('create')
  createLobby(@Body() dto: CreateLobbyDto, @Req() req: AuthenticatedRequest) {
    return this.lobbyService.createLobby(dto, req.user);
  }

  /**
   * Sends a join request to a specific lobby.
   */
  @Post(':lobbyId/request')
  createJoinRequest(
    @Param('lobbyId') lobbyId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.lobbyService.createJoinRequest(lobbyId, req.user);
  }

  /**
   * Cancels the authenticated user's join request to the specified lobby.
   */
  @Delete(':lobbyId/request')
  cancelJoinRequest(
    @Param('lobbyId') lobbyId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.lobbyService.cancelJoinRequest(lobbyId, req.user);
  }

  /**
   * Approves a user's join request to the lobby. Only the lobby owner is authorized.
   */
  @Patch(':lobbyId/requests/:userId/approve')
  @UseGuards(IsLobbyOwnerGuard)
  approveJoinRequest(
    @Param('lobbyId') lobbyId: string,
    @Param('userId') userId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.lobbyService.approveJoinRequest(lobbyId, userId, req.user);
  }

  /**
   * Rejects a user's join request to the lobby. Only the lobby owner is authorized.
   */
  @Delete(':lobbyId/requests/:userId/reject')
  @UseGuards(IsLobbyOwnerGuard)
  rejectJoinRequest(
    @Param('lobbyId') lobbyId: string,
    @Param('userId') userId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.lobbyService.rejectJoinRequest(lobbyId, userId, req.user);
  }

  /**
   * Retrieves a list of pending join requests for the lobby. Only the lobby owner is authorized.
   */
  @Get(':lobbyId/pending-requests')
  @UseGuards(IsLobbyOwnerGuard)
  getPendingRequests(
    @Param('lobbyId') lobbyId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.lobbyService.getPendingRequests(lobbyId, req.user);
  }

  /**
   * Retrieves the lobby the authenticated user currently belongs to.
   */
  @Get('/myLobby')
  getMyLobby(@Req() req: AuthenticatedRequest) {
    return this.lobbyService.getMyLobby(req.user);
  }

  /**
   * Retrieves a lobby by its ID, if the user is authorized to access it.
   */
  @Get('/:lobbyId')
  getLobby(
    @Param('lobbyId') lobbyId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.lobbyService.getLobby(lobbyId, req.user);
  }

  /**
   * Updates the visibility status (public/private) of a lobby. Only the owner is authorized.
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

  /**
   * Allows the authenticated user to leave their current lobby.
   */
  @Post('leave')
  leaveLobby(@Req() req: AuthenticatedRequest) {
    return this.lobbyService.leaveLobby(req.user);
  }

  /**
   * Removes a member from the lobby. Only the lobby owner is authorized.
   */
  @Delete(':lobbyId/members/:userId')
  @UseGuards(JwtAuthGuard, IsLobbyOwnerGuard)
  removeMember(
    @Param('lobbyId') lobbyId: string,
    @Param('userId') userId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.lobbyService.removeMember(lobbyId, userId, req.user);
  }
}
