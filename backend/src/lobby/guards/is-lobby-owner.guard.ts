import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthenticatedRequest } from 'src/auth/auth-request.interface';

/**
 * Lobby Ownership Verification Guard
 *
 * Ensures only the owner of a lobby can perform sensitive operations by:
 * - Validating lobby existence
 * - Verifying requestor's ownership status
 *
 * Used to protect lobby management endpoints
 */
@Injectable()
export class IsLobbyOwnerGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  /**
   * Ownership verification logic
   * @param context - Execution context containing request details
   * @returns boolean confirming ownership
   * @throws ForbiddenException if ownership verification fails
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    const lobbyId = request.params.lobbyId;

    // Fetch lobby ownership information
    const lobby = await this.prisma.lobby.findUnique({
      where: { id: lobbyId },
      select: { ownerId: true }, // Only select needed field
    });

    // Verify lobby exists
    if (!lobby) {
      throw new ForbiddenException('Lobby not found.');
    }

    // Verify requesting user is the owner
    if (lobby.ownerId !== user.id) {
      throw new ForbiddenException('You are not the owner of this lobby.');
    }

    return true;
  }
}
