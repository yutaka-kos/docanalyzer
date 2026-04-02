// Simple TF-IDF vectorizer for RAG
export class TfIdfVectorizer {
  private vocabulary: Map<string, number> = new Map();
  private idf: Map<string, number> = new Map();

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s\u3000-\u9fff\uf900-\ufaff]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1);
  }

  fit(documents: string[]) {
    const df: Map<string, number> = new Map();
    const allTokens = new Set<string>();

    for (const doc of documents) {
      const tokens = new Set(this.tokenize(doc));
      for (const token of tokens) {
        allTokens.add(token);
        df.set(token, (df.get(token) || 0) + 1);
      }
    }

    // Build vocabulary from top 1000 tokens by document frequency
    const sorted = [...df.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 1000);

    this.vocabulary.clear();
    this.idf.clear();

    sorted.forEach(([token, count], i) => {
      this.vocabulary.set(token, i);
      this.idf.set(token, Math.log(documents.length / (1 + count)));
    });
  }

  transform(documents: string[]): number[][] {
    return documents.map((doc) => {
      const tokens = this.tokenize(doc);
      const tf: Map<string, number> = new Map();
      for (const token of tokens) {
        tf.set(token, (tf.get(token) || 0) + 1);
      }

      const vector = new Array(this.vocabulary.size).fill(0);
      for (const [token, freq] of tf) {
        const idx = this.vocabulary.get(token);
        if (idx !== undefined) {
          vector[idx] = (freq / tokens.length) * (this.idf.get(token) || 0);
        }
      }
      return vector;
    });
  }

  fitTransform(documents: string[]): number[][] {
    this.fit(documents);
    return this.transform(documents);
  }
}

// Singleton
export const vectorizer = new TfIdfVectorizer();
