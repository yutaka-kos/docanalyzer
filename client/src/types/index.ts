export interface Document {
  id: string;
  name: string;
  text: string;
  chunks: Chunk[];
  vectors: number[][];
  createdAt: number;
}

export interface Chunk {
  id: string;
  text: string;
  index: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: Chunk[];
}

export interface KeywordResult {
  word: string;
  score: number;
  category?: string;
}

export interface SentimentResult {
  paragraph: number;
  text: string;
  sentiment: number;
  tone: string;
}

export interface AnalysisResults {
  summary?: string;
  keywords?: KeywordResult[];
  sentiment?: SentimentResult[];
}

export type TabType = 'summary' | 'chat' | 'keywords' | 'sentiment';
