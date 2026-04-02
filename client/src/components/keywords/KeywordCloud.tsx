import { useState } from 'react';
import { Tags, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useDocumentStore } from '../../hooks/useDocumentStore';
import { extractKeywords } from '../../lib/api';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

const colors = [
  'text-blue-400', 'text-purple-400', 'text-cyan-400',
  'text-emerald-400', 'text-amber-400', 'text-rose-400',
  'text-indigo-400', 'text-teal-400',
];

export function KeywordCloud() {
  const doc = useDocumentStore((s) => s.getActiveDocument());
  const analysisResults = useDocumentStore((s) => s.analysisResults);
  const setAnalysis = useDocumentStore((s) => s.setAnalysis);
  const [isLoading, setIsLoading] = useState(false);

  if (!doc) return null;

  const keywords = analysisResults[doc.id]?.keywords;

  const handleExtract = async () => {
    setIsLoading(true);
    try {
      const results = await extractKeywords(doc.text);
      setAnalysis(doc.id, { keywords: results });
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!keywords && !isLoading) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card className="text-center py-12">
          <Tags size={32} className="text-blue-400 mx-auto mb-4" />
          <p className="text-gray-300 mb-4">Extract key topics and themes from your document</p>
          <Button onClick={handleExtract}>Extract Keywords</Button>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-blue-500" />
        <span className="ml-2 text-gray-400 text-sm">Extracting keywords...</span>
      </div>
    );
  }

  const maxScore = Math.max(...(keywords || []).map((k) => k.score));

  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <div className="flex flex-wrap gap-3 justify-center py-4">
          {keywords?.map((kw, i) => {
            const ratio = kw.score / maxScore;
            const fontSize = 14 + ratio * 28;
            return (
              <motion.div
                key={kw.word}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                className={`px-3 py-1.5 rounded-full bg-gray-800/50 border border-gray-700/50 cursor-default hover:bg-gray-800 transition-colors ${colors[i % colors.length]}`}
                style={{ fontSize: `${fontSize}px` }}
                title={`Score: ${kw.score.toFixed(2)}${kw.category ? ` | ${kw.category}` : ''}`}
              >
                {kw.word}
              </motion.div>
            );
          })}
        </div>
      </Card>
      <div className="mt-4">
        <Button variant="ghost" size="sm" onClick={handleExtract}>
          Re-extract
        </Button>
      </div>
    </div>
  );
}
