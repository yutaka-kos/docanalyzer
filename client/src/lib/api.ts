import type { KeywordResult, SentimentResult } from '../types';

function parseSSEData(data: string): string {
  if (data === '[DONE]') return '';
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

async function* readSSEStream(res: Response): AsyncGenerator<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') return;
        const parsed = parseSSEData(data);
        if (parsed) yield parsed;
      }
    }
  }
}

export async function* streamSummary(text: string): AsyncGenerator<string> {
  const res = await fetch('/api/analyze/summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error('Failed to generate summary');
  yield* readSSEStream(res);
}

export async function* streamChat(
  messages: { role: string; content: string }[],
  context: string
): AsyncGenerator<string> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, context }),
  });
  if (!res.ok) throw new Error('Failed to get chat response');
  yield* readSSEStream(res);
}

export async function extractKeywords(text: string): Promise<KeywordResult[]> {
  const res = await fetch('/api/analyze/keywords', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error('Failed to extract keywords');
  return res.json();
}

export async function analyzeSentiment(text: string): Promise<SentimentResult[]> {
  const res = await fetch('/api/analyze/sentiment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error('Failed to analyze sentiment');
  return res.json();
}

export async function getEmbeddings(chunks: string[]): Promise<number[][]> {
  const res = await fetch('/api/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chunks }),
  });
  if (!res.ok) throw new Error('Failed to get embeddings');
  return res.json();
}
