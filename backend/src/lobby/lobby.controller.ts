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

@Controller('lobby')
@UseGuards(JwtAuthGuard)
export class LobbyController {
  constructor(private readonly lobbyService: LobbyService) {}

  @Post('create')
  createLobby(@Body() dto: CreateLobbyDto, @Req() req) {
    return this.lobbyService.createLobby(dto, req.user.steamId);
  }

  @Post('join/:lobbyId')
  joinLobby(@Param('lobbyId') lobbyId: string, @Req() req) {
    return this.lobbyService.joinLobby(lobbyId, req.user.steamId);
  }

  @Get('/myLobby')
  getMyLobby(@Req() req) {
    return this.lobbyService.getMyLobby(req.user.steamId);
  }

  @Get('/:lobbyId')
  getLobby(@Param('lobbyId') lobbyId: string, @Req() req) {
    return this.lobbyService.getLobby(lobbyId, req.user.steamId);
  }

  @Patch('/:lobbyId/visibility')
  @UseGuards(JwtAuthGuard, IsLobbyOwnerGuard)
  updateLobbyVisibility(
    @Param('lobbyId') lobbyId: string,
    @Body() body: { visibility: 'PUBLIC' | 'PRIVATE' },
    @Req() req,
  ) {
    return this.lobbyService.updateLobbyVisibility(
      lobbyId,
      req.user.steamId,
      body.visibility,
    );
  }
}
