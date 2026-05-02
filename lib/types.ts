export type ChunkMeta = {
  id: string;
  source: string;
  sourceTitle: string;
  pageHint?: string;
  text: string;
};

export type EmbeddedChunk = ChunkMeta & {
  embedding: number[];
};

export type CorpusFile = {
  model: string;
  dimensions: number;
  chunks: EmbeddedChunk[];
};

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type Citation = {
  source: string;
  sourceTitle: string;
  pageHint?: string;
  excerpt: string;
};

export type ChatResponse = {
  answer: string;
  citations: Citation[];
};

export type QuizQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  citation: Citation;
};

export type QuizResponse = {
  topic: string;
  questions: QuizQuestion[];
};
