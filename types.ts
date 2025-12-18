
export interface DesignStyle {
  id: string;
  name: string;
  description: string;
  prompt: string;
  thumbnail: string;
  category: 'Modern' | 'Classic' | 'Cultural' | 'Niche' | 'Nature' | 'Retro';
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  isImageAction?: boolean;
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}
