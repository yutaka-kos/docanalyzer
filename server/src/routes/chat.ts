import { Router } from 'express';
import { streamChat } from '../lib/claude.js';
import { QA_PROMPT } from '../lib/prompts.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const { messages, context } = req.body;
    if (!messages || !context) {
      return res.status(400).json({ error: 'messages and context are required' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const systemPrompt = QA_PROMPT.replace('{context}', context);
    const stream = await streamChat(systemPrompt, messages);

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify(event.delta.text)}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: any) {
    console.error('Chat error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

export default router;
