import { Router } from 'express';
import { streamMessage, createMessage } from '../lib/claude.js';
import { SUMMARY_PROMPT, KEYWORDS_PROMPT, SENTIMENT_PROMPT } from '../lib/prompts.js';

const router = Router();

// Summary (SSE streaming)
router.post('/summary', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const truncated = text.slice(0, 100000);
    const stream = await streamMessage(SUMMARY_PROMPT, truncated);

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        // JSON encode to safely transmit newlines and special chars
        res.write(`data: ${JSON.stringify(event.delta.text)}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: any) {
    console.error('Summary error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

// Keywords
router.post('/keywords', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });

    const truncated = text.slice(0, 100000);
    const result = await createMessage(KEYWORDS_PROMPT, truncated);

    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'Failed to parse keywords' });
    }

    const keywords = JSON.parse(jsonMatch[0]);
    res.json(keywords);
  } catch (err: any) {
    console.error('Keywords error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Sentiment
router.post('/sentiment', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });

    const truncated = text.slice(0, 100000);
    const result = await createMessage(SENTIMENT_PROMPT, truncated);

    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'Failed to parse sentiment' });
    }

    const sentiment = JSON.parse(jsonMatch[0]);
    res.json(sentiment);
  } catch (err: any) {
    console.error('Sentiment error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
