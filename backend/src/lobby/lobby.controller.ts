import { Controller, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('lobby')
@UseGuards(JwtAuthGuard)
export class LobbyController {}
