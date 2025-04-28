import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthenticatedRequest } from 'src/auth/auth-request.interface';

/**
 * Replay Upload Authorization Guard
 *
 * Verifies if a user has sufficient privileges to upload replays by checking:
 * - Lobby ownership status
 * - Admin membership status
 *
 * Used to protect replay upload endpoints
 */
@Injectable()
export class CanUploadReplayGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  /**
   * Authorization logic for replay uploads
   * @param context - Execution context containing request details
   * @returns boolean indicating authorization status
   * @throws ForbiddenException if user lacks required privileges
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    // Debug logging (consider removing in production)
    console.log('user', user);

    // Fetch complete user data with lobby relationships
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        role: true,
        lobby: true, // Owned lobby
        memberLobby: true, // Joined lobby
      },
    });

    // Verify user exists in database
    if (!dbUser) {
      throw new ForbiddenException('User not found in database.');
    }

    // Check authorization conditions
    const isOwner = dbUser.lobby !== null;
    const isAdminMember =
      dbUser.memberLobby !== null && dbUser.role === 'ADMIN';

    // Grant access if either condition is met
    if (isOwner || isAdminMember) {
      return true;
    }

    // Deny access with descriptive message
    throw new ForbiddenException(
      'You must be a lobby owner or assigned admin to upload replays.',
    );
  }
}
