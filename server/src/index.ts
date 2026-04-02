import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import analyzeRouter from './routes/analyze.js';
import chatRouter from './routes/chat.js';
import embedRouter from './routes/embed.js';

const app = express();
const PORT = 3001;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '10mb' }));

app.use('/api/analyze', analyzeRouter);
app.use('/api/chat', chatRouter);
app.use('/api/embed', embedRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
