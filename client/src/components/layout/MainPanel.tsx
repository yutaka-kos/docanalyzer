import { useState } from 'react';
import { useDocumentStore } from '../../hooks/useDocumentStore';
import { Header } from './Header';
import { FileUploader } from '../upload/FileUploader';
import { SummaryView } from '../summary/SummaryView';
import { ChatPanel } from '../chat/ChatPanel';
import { KeywordCloud } from '../keywords/KeywordCloud';
import { SentimentChart } from '../sentiment/SentimentChart';
import type { TabType } from '../../types';
import { Upload } from 'lucide-react';

export function MainPanel({ showUpload, onCloseUpload }: { showUpload: boolean; onCloseUpload: () => void }) {
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const doc = useDocumentStore((s) => s.getActiveDocument());

  const renderContent = () => {
    if (showUpload) {
      return <FileUploader onDone={onCloseUpload} />;
    }

    if (!doc) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center">
            <Upload size={24} className="text-gray-600" />
          </div>
          <div className="text-center">
            <p className="text-lg font-medium text-gray-400">No document selected</p>
            <p className="text-sm mt-1">Upload a PDF or text file to begin analysis</p>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'summary':
        return <SummaryView />;
      case 'chat':
        return <ChatPanel />;
      case 'keywords':
        return <KeywordCloud />;
      case 'sentiment':
        return <SentimentChart />;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 overflow-y-auto p-6">
        {renderContent()}
      </div>
    </div>
  );
}
