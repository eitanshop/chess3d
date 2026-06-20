export type PlayerColor = 'w' | 'b';

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

// Piece materials
export type PieceSetType = 'standard' | 'wood' | 'plastic' | 'stone';

// New: Board Styles
export type BoardStyle = 'wood' | 'marble' | 'glass' | 'slate' | 'stone';

export interface GameState {
  fen: string;
  turn: PlayerColor;
  isGameOver: boolean;
  isCheck: boolean;
  isCheckmate: boolean;
  isDraw: boolean;
  history: string[];
  capturedWhite: string[]; // pieces captured BY white (black pieces)
  capturedBlack: string[]; // pieces captured BY black (white pieces)
}

export interface MoveData {
  from: string;
  to: string;
  promotion?: string;
}

export interface AIMoveResponse {
  move: string;
  reasoning: string;
}

export interface CapturedPiece {
  id: string; // Unique ID for animation key (e.g. square-type-color-timestamp)
  type: string;
  color: 'w' | 'b';
  square: string; // The square it died on
}