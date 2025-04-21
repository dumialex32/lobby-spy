import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthenticatedRequest } from 'src/auth/auth-request.interface';

@Injectable()
export class CanUploadReplayGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    console.log('user', user);
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        role: true,
        lobby: true,
        memberLobby: true,
      },
    });

    if (!dbUser) {
      throw new ForbiddenException('User not found in database.');
    }

    const isOwner = dbUser.lobby !== null;
    const isAdminMember =
      dbUser.memberLobby !== null && dbUser.role === 'ADMIN';

    if (isOwner || isAdminMember) {
      return true;
    }

    throw new ForbiddenException(
      'You must be a lobby owner or assigned admin to upload replays.',
    );
  }
}
