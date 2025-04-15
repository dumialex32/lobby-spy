export type CurrentGamePlayerStats = {
  steamId: string;
  playerName: string;
  kills: number;
  deaths: number;
  assists: number;
  networth: number;
  lastHits: number;
  denies: number;
};

export type ProcessReplayResponse = {
  message: string;
  matchId: string;
  playerCount: number;
  duration: number;
  winner: number;
};
