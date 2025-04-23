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
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
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
    return this.lobbyService.createLobby(dto, req.user.steamId);
  }

  // Join lobby controller
  @Post('join/:lobbyId')
  joinLobby(
    @Param('lobbyId') lobbyId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.lobbyService.joinLobby(lobbyId, req.user.steamId);
  }

  // Get personal lobby controller
  @Get('/myLobby')
  getMyLobby(@Req() req: AuthenticatedRequest) {
    return this.lobbyService.getMyLobby(req.user.steamId);
  }

  // Get lobby controller
  @Get('/:lobbyId')
  getLobby(
    @Param('lobbyId') lobbyId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.lobbyService.getLobby(lobbyId, req.user.steamId);
  }

  // Update lobby visibility controller
  @Patch('/:lobbyId/visibility')
  @UseGuards(JwtAuthGuard, IsLobbyOwnerGuard)
  updateLobbyVisibility(
    @Param('lobbyId') lobbyId: string,
    @Body() dto: UpdateLobbyVisibilityDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.lobbyService.updateLobbyVisibility(
      lobbyId,
      req.user.steamId,
      dto.visibility,
    );
  }
}
