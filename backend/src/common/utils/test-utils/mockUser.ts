import { UserRole } from '@prisma/client';
import { UserWithLobbyRelations } from 'src/users/types/user.types';

// Helper function to create a mock user
export const createMockUser = (
  overrides: Partial<UserWithLobbyRelations> = {},
): UserWithLobbyRelations => ({
  id: 'user-id',
  steamId: 'steam-id',
  username: 'testuser',
  avatar: 'avatar-url',
  lobbyId: null,
  role: UserRole.MEMBER,
  createdAt: new Date(),
  updatedAt: new Date(),
  memberLobby: null,
  lobby: null,
  ...overrides,
});

// Helper function to create a mock profile
export const createMockProfile = () => ({
  id: 'steam-id',
  displayName: 'testuser',
  photos: [{ value: 'avatar-url' }],
});
