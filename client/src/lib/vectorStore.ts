import type { Chunk } from '../types';
import { cosineSimilarity } from './cosine';

export class VectorStore {
  private chunks: Chunk[] = [];
  private vectors: number[][] = [];

  addChunks(chunks: Chunk[], vectors: number[][]) {
    this.chunks = chunks;
    this.vectors = vectors;
  }

  search(queryVector: number[], topK = 3): Chunk[] {
    if (this.chunks.length === 0) return [];

    const scores = this.chunks.map((chunk, i) => ({
      chunk,
      score: cosineSimilarity(queryVector, this.vectors[i]),
    }));

    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK).map((s) => s.chunk);
  }

  getChunks() {
    return this.chunks;
  }

  clear() {
    this.chunks = [];
    this.vectors = [];
  }
}

// Singleton
export const vectorStore = new VectorStore();
