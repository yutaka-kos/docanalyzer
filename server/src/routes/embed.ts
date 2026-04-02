import { Router } from 'express';
import { vectorizer } from '../lib/tfidf.js';

const router = Router();

router.post('/', (req, res) => {
  try {
    const { chunks } = req.body;
    if (!chunks || !Array.isArray(chunks)) {
      return res.status(400).json({ error: 'chunks array is required' });
    }

    const vectors = vectorizer.fitTransform(chunks);
    res.json(vectors);
  } catch (err: any) {
    console.error('Embed error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
