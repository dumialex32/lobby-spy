export type ParsedRawMatchend = {
  team: 'Radiant' | 'Dire';
  name: string;
  level: number;
  kills: number;
  deaths: number;
  assists: number;
  gold: number;
  lastHits: number;
  denies: number;
  steamId: number;
};

export type ParsedRawInfo = {
  matchId: number;
  duration: number;
  winner: string;
  players: {
    hero: string;
    name: string;
    steamId: number;
    team: number;
  }[];
};
