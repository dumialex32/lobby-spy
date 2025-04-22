// backend/src/lobby/guards/is-lobby-owner.guard.ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthenticatedRequest } from 'src/auth/auth-request.interface';

@Injectable()
export class IsLobbyOwnerGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    const lobbyId = request.params.lobbyId;

    const lobby = await this.prisma.lobby.findUnique({
      where: { id: lobbyId },
      select: { ownerId: true },
    });

    if (!lobby) {
      throw new ForbiddenException('Lobby not found.');
    }

    if (lobby.ownerId !== user.id) {
      throw new ForbiddenException('You are not the owner of this lobby.');
    }

    return true;
  }
}
