import { FileText } from 'lucide-react';
import { useDocumentStore } from '../../hooks/useDocumentStore';
import { Tabs } from '../ui/Tabs';
import type { TabType } from '../../types';

interface HeaderProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export function Header({ activeTab, onTabChange }: HeaderProps) {
  const doc = useDocumentStore((s) => s.getActiveDocument());

  return (
    <header className="h-14 border-b border-gray-800 flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        {doc ? (
          <>
            <FileText size={16} className="text-blue-400" />
            <span className="text-sm font-medium">{doc.name}</span>
            <span className="text-xs text-gray-600">
              {(doc.text.length / 1000).toFixed(1)}k chars
            </span>
          </>
        ) : (
          <span className="text-sm text-gray-500">Upload a document to start</span>
        )}
      </div>
      {doc && <Tabs active={activeTab} onChange={onTabChange} />}
    </header>
  );
}
