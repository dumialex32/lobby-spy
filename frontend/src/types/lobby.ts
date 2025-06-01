type LobbyVisibility = "PUBLIC" | "PRIVATE";

export interface Lobby {
  name: string;
  id: string;
  createdAt: Date;
  updatedAt: Date;
  imageUrl: string | null;
  description: string;
  visibility: LobbyVisibility;
  capacity: number;
  ownerId: string;
}
