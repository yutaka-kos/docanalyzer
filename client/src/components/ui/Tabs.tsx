import type { TabType } from '../../types';

interface TabsProps {
  active: TabType;
  onChange: (tab: TabType) => void;
}

const tabs: { key: TabType; label: string }[] = [
  { key: 'summary', label: 'Summary' },
  { key: 'chat', label: 'Q&A Chat' },
  { key: 'keywords', label: 'Keywords' },
  { key: 'sentiment', label: 'Sentiment' },
];

export function Tabs({ active, onChange }: TabsProps) {
  return (
    <div className="flex gap-1 bg-gray-900 p-1 rounded-lg border border-gray-800">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
            active === tab.key
              ? 'bg-gray-800 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
