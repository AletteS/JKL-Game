
export enum GameState {
  START = 'START',
  PLAYING = 'PLAYING',
  WON = 'WON',
  GAME_OVER = 'GAME_OVER'
}

export type GameMode = 'STANDARD' | 'CAT_MODE';

export interface TimelineSegment {
  id: string;
  x: number;
  width: number;
  color: string;
}

export interface SequenceClip {
  id: string;
  width: number;
  color: string;
}

export type SpeedMultiplier = number;

export interface HighScore {
  name: string;
  score: number;
  mode: GameMode;
  date: number;
}
