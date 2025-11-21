
export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;

export const COLORS = {
  RED: '#ef4444',
  BLUE: '#3b82f6',
  GREEN: '#22c55e',
  YELLOW: '#eab308',
  PURPLE: '#a855f7',
  ORANGE: '#f97316',
};

// Pentatonic Scale Frequencies (C Majorish)
export const COLOR_FREQUENCIES: Record<string, number> = {
  [COLORS.RED]: 261.63,    // C4
  [COLORS.ORANGE]: 293.66, // D4
  [COLORS.YELLOW]: 329.63, // E4
  [COLORS.GREEN]: 349.23,  // F4
  [COLORS.BLUE]: 392.00,   // G4
  [COLORS.PURPLE]: 440.00, // A4
};

export const AVAILABLE_COLORS = Object.values(COLORS);

// Layout
export const SOURCE_TRACK_Y = 220; // Moved down slightly to fit cat on top
export const AUDIO_TRACK_Y = 300; // For Cat Mode Audio
export const SEQUENCE_TRACK_Y = 480;
export const TRACK_HEIGHT = 80;
export const TRACK_HEIGHT_COMPACT = 60; // For split video/audio view

export const SEGMENT_MIN_WIDTH = 100;
export const SEGMENT_MAX_WIDTH = 300;

export const MAX_SPEED = 32;

// Game Logic
export const WIN_PIXELS = 1200; // Total width needed to win
export const BAD_HABIT_THRESHOLD = 5; // How many steps before penalty score starts hitting hard
export const HIGH_SCORE_KEY = 'jkl_cut_high_scores';

// Keys
export const KEY_J = 'j';
export const KEY_K = 'k';
export const KEY_L = 'l';
export const KEY_I = 'i';
export const KEY_O = 'o';
export const KEY_PERIOD = '.';
