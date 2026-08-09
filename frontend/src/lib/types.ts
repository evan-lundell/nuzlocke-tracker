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

export interface GameRoute {
  id: string;
  gameId: string;
  identifier: string;
  name: string;
  order: number;
}

export interface Species {
  id: string;
  identifier: string;
  name: string;
  pokedexNumber: number;
  typePrimary: string;
  typeSecondary: string | null;
}

export interface RouteSpeciesEntry {
  id: string;
  routeId: string;
  speciesId: string;
  species: Species;
  method: string | null;
}

export type VitalStatus = 'ALIVE' | 'DEAD';

export interface Encounter {
  id: string;
  runId: string;
  routeId: string;
  route: GameRoute;
  speciesId: string | null;
  species: Species | null;
  label: string;
  order: number;
  caught: boolean;
  nickname: string | null;
  vitalStatus: VitalStatus | null;
}
