import { Request } from 'express';
import { UserWithLobbyRelations } from 'src/users/types/user.types';

export interface AuthenticatedRequest extends Request {
  user: UserWithLobbyRelations;
  cookies: {
    accessToken?: string;
    refreshToken?: string;
    [key: string]: string | undefined;
  };
}
