import type { Chunk } from '../types';

export function splitIntoChunks(text: string, maxChars = 1500, overlap = 200): Chunk[] {
  const sentences = text.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) || [text];
  const chunks: Chunk[] = [];
  let current = '';
  let index = 0;

  for (const sentence of sentences) {
    if (current.length + sentence.length > maxChars && current.length > 0) {
      chunks.push({
        id: `chunk_${index}`,
        text: current.trim(),
        index,
      });
      // Keep overlap
      const words = current.split(' ');
      const overlapWords = words.slice(-Math.ceil(overlap / 5));
      current = overlapWords.join(' ') + ' ' + sentence;
      index++;
    } else {
      current += sentence;
    }
  }

  if (current.trim()) {
    chunks.push({
      id: `chunk_${index}`,
      text: current.trim(),
      index,
    });
  }

  return chunks;
}
