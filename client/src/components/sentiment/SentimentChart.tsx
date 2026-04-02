import { useState } from 'react';
import { BarChart3, Loader2 } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';
import { useDocumentStore } from '../../hooks/useDocumentStore';
import { analyzeSentiment } from '../../lib/api';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

const SENTIMENT_COLORS = { positive: '#22c55e', negative: '#ef4444', neutral: '#6b7280' };

export function SentimentChart() {
  const doc = useDocumentStore((s) => s.getActiveDocument());
  const analysisResults = useDocumentStore((s) => s.analysisResults);
  const setAnalysis = useDocumentStore((s) => s.setAnalysis);
  const [isLoading, setIsLoading] = useState(false);

  if (!doc) return null;

  const sentiment = analysisResults[doc.id]?.sentiment;

  const handleAnalyze = async () => {
    setIsLoading(true);
    try {
      const results = await analyzeSentiment(doc.text);
      setAnalysis(doc.id, { sentiment: results });
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!sentiment && !isLoading) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card className="text-center py-12">
          <BarChart3 size={32} className="text-blue-400 mx-auto mb-4" />
          <p className="text-gray-300 mb-4">Analyze the emotional tone and sentiment of your document</p>
          <Button onClick={handleAnalyze}>Analyze Sentiment</Button>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-blue-500" />
        <span className="ml-2 text-gray-400 text-sm">Analyzing sentiment...</span>
      </div>
    );
  }

  // Area chart data
  const areaData = sentiment?.map((s, i) => ({
    paragraph: `P${i + 1}`,
    sentiment: s.sentiment,
  }));

  // Pie chart data
  const positive = sentiment?.filter((s) => s.sentiment > 0.1).length || 0;
  const negative = sentiment?.filter((s) => s.sentiment < -0.1).length || 0;
  const neutral = (sentiment?.length || 0) - positive - negative;
  const pieData = [
    { name: 'Positive', value: positive, color: SENTIMENT_COLORS.positive },
    { name: 'Negative', value: negative, color: SENTIMENT_COLORS.negative },
    { name: 'Neutral', value: neutral, color: SENTIMENT_COLORS.neutral },
  ];

  // Radar chart data (tone distribution)
  const tones: Record<string, number> = {};
  sentiment?.forEach((s) => {
    tones[s.tone] = (tones[s.tone] || 0) + 1;
  });
  const radarData = Object.entries(tones).map(([tone, count]) => ({
    tone,
    count,
    fullMark: sentiment?.length || 1,
  }));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Sentiment Flow */}
      <Card>
        <h3 className="text-sm font-medium text-gray-400 mb-4">Sentiment Flow</h3>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={areaData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="paragraph" tick={{ fill: '#6b7280', fontSize: 12 }} />
            <YAxis domain={[-1, 1]} tick={{ fill: '#6b7280', fontSize: 12 }} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#9ca3af' }}
            />
            <defs>
              <linearGradient id="sentimentGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="sentiment"
              stroke="#3b82f6"
              fill="url(#sentimentGradient)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        {/* Pie Chart */}
        <Card>
          <h3 className="text-sm font-medium text-gray-400 mb-4">Sentiment Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                dataKey="value"
                strokeWidth={0}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-2">
            {pieData.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs text-gray-400">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                {d.name} ({d.value})
              </div>
            ))}
          </div>
        </Card>

        {/* Radar Chart */}
        <Card>
          <h3 className="text-sm font-medium text-gray-400 mb-4">Tone Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#374151" />
              <PolarAngleAxis dataKey="tone" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <PolarRadiusAxis tick={false} axisLine={false} />
              <Radar
                dataKey="count"
                stroke="#8b5cf6"
                fill="#8b5cf6"
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Button variant="ghost" size="sm" onClick={handleAnalyze}>
        Re-analyze
      </Button>
    </div>
  );
}
