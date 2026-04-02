import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useDocumentStore } from '../../hooks/useDocumentStore';
import { streamSummary } from '../../lib/api';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

export function SummaryView() {
  const doc = useDocumentStore((s) => s.getActiveDocument());
  const analysisResults = useDocumentStore((s) => s.analysisResults);
  const setAnalysis = useDocumentStore((s) => s.setAnalysis);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamedText, setStreamedText] = useState('');

  if (!doc) return null;

  const existing = analysisResults[doc.id]?.summary;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setStreamedText('');

    try {
      let fullText = '';
      for await (const chunk of streamSummary(doc.text)) {
        fullText += chunk;
        setStreamedText(fullText);
      }
      setAnalysis(doc.id, { summary: fullText });
    } catch (err: any) {
      setStreamedText(`Error: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const displayText = isGenerating ? streamedText : existing || '';

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {!displayText && !isGenerating ? (
        <Card className="text-center py-12">
          <Sparkles size={32} className="text-blue-400 mx-auto mb-4" />
          <p className="text-gray-300 mb-4">Generate an AI-powered summary of your document</p>
          <Button onClick={handleGenerate}>Generate Summary</Button>
        </Card>
      ) : (
        <>
          {isGenerating && (
            <div className="flex items-center gap-2 text-blue-400 text-sm mb-2">
              <Loader2 size={14} className="animate-spin" />
              <span>Generating summary...</span>
            </div>
          )}
          <Card>
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayText}</ReactMarkdown>
            </div>
          </Card>
          {!isGenerating && existing && (
            <Button variant="ghost" size="sm" onClick={handleGenerate}>
              Regenerate
            </Button>
          )}
        </>
      )}
    </div>
  );
}
