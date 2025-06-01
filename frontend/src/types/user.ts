import type { Lobby } from "./lobby";

type UserRole = "MEMBER" | "ADMIN" | "OWNER";

export interface User {
  id: string;
  steamId: string;
  username: string | null;
  avatar: string | null;
  lobbyId: string | null;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  lobby: Lobby | null;
  memberLobby: Lobby | null;
}

export interface Session {
  id: string;
  ipAddress: string;
  device: string;
  browser: string;
  os: string;
  createdAt: string;
  lastActiveAt: string;
  isCurrent: boolean;
}
