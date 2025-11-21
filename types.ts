export interface ImageState {
  original: string | null; // Base64 URL
  current: string | null;  // Base64 URL (after edits)
  history: string[];       // Undo stack
}

export interface VectorGlyph {
  id: string;
  svgPath: string;
  width: number;
  height: number;
  name: string;
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  GENERATING = 'GENERATING',
  VECTORIZING = 'VECTORIZING',
  ERROR = 'ERROR'
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}