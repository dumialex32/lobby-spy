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
@UseGuards(JwtAuthGuard)
export class LobbyController {
  constructor(private readonly lobbyService: LobbyService) {}

  @Post('create')
  createLobby(@Body() dto: CreateLobbyDto, @Req() req: AuthenticatedRequest) {
    return this.lobbyService.createLobby(dto, req.user);
  }

  @Post(':lobbyId/request')
  createJoinRequest(
    @Param('lobbyId') lobbyId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.lobbyService.createJoinRequest(lobbyId, req.user);
  }

  @Delete(':lobbyId/request')
  cancelJoinRequest(
    @Param('lobbyId') lobbyId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.lobbyService.cancelJoinRequest(lobbyId, req.user);
  }

  @Patch(':lobbyId/requests/:userId/approve')
  @UseGuards(IsLobbyOwnerGuard)
  approveJoinRequest(
    @Param('lobbyId') lobbyId: string,
    @Param('userId') userId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.lobbyService.approveJoinRequest(lobbyId, userId, req.user);
  }

  @Delete(':lobbyId/requests/:userId/reject')
  @UseGuards(IsLobbyOwnerGuard)
  rejectJoinRequest(
    @Param('lobbyId') lobbyId: string,
    @Param('userId') userId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.lobbyService.rejectJoinRequest(lobbyId, userId, req.user);
  }

  @Get(':lobbyId/pending-requests')
  @UseGuards(IsLobbyOwnerGuard)
  getPendingRequests(
    @Param('lobbyId') lobbyId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.lobbyService.getPendingRequests(lobbyId, req.user);
  }

  @Get('/myLobby')
  getMyLobby(@Req() req: AuthenticatedRequest) {
    return this.lobbyService.getMyLobby(req.user);
  }

  @Get('/:lobbyId')
  getLobby(
    @Param('lobbyId') lobbyId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.lobbyService.getLobby(lobbyId, req.user);
  }

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

  @Post('leave')
  leaveLobby(@Req() req: AuthenticatedRequest) {
    return this.lobbyService.leaveLobby(req.user);
  }

  @Delete(':lobbyId/members/:userId')
  @UseGuards(JwtAuthGuard, IsLobbyOwnerGuard)
  kickMember(
    @Param('lobbyId') lobbyId: string,
    @Param('userId') userId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.lobbyService.kickMember(lobbyId, userId, req.user);
  }
}
