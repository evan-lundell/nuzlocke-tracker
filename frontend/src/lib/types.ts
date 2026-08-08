export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface Game {
  id: string;
  identifier: string;
  name: string;
  generation: number;
}

export type RunStatus = 'ACTIVE' | 'FAILED' | 'COMPLETED';

export interface Run {
  id: string;
  userId: string;
  gameId: string;
  game: Game;
  legacyId: string | null;
  status: RunStatus;
  name: string | null;
  startedAt: string;
  endedAt: string | null;
}
