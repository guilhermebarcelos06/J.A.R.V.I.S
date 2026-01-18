export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}

export interface AudioState {
  isPlaying: boolean;
  isListening: boolean;
  volume: number;
}

export type MessageRole = 'user' | 'model';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text?: string;
  image?: string; // Base64 string
  timestamp: number;
}