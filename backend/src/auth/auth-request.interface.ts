import { Request } from 'express';
import { UserWithLobbyRelations } from 'src/users/types/user.types';

export interface AuthenticatedRequest extends Request {
  user: UserWithLobbyRelations;
}
