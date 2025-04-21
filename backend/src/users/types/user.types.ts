import { Lobby, User } from '@prisma/client';

export type UserWithLobbyRelations = User & {
  lobby?: Lobby | null;
  memberLobby?: Lobby | null;
};
