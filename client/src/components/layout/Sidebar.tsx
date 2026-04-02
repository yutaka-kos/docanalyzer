import { FileText, Plus, Trash2 } from 'lucide-react';
import { useDocumentStore } from '../../hooks/useDocumentStore';

export function Sidebar({ onUploadClick }: { onUploadClick: () => void }) {
  const { documents, activeDocumentId, setActive } = useDocumentStore();

  return (
    <aside className="w-64 h-full bg-gray-950 border-r border-gray-800 flex flex-col">
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <FileText size={16} />
          </div>
          <h1 className="text-lg font-semibold">DocAnalyzer</h1>
        </div>
        <button
          onClick={onUploadClick}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={16} />
          Upload Document
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <p className="text-xs text-gray-500 uppercase tracking-wider px-2 py-2">
          Documents ({documents.length})
        </p>
        {documents.length === 0 ? (
          <p className="text-sm text-gray-600 px-2 py-4 text-center">
            No documents yet
          </p>
        ) : (
          <div className="space-y-1">
            {documents.map((doc) => (
              <button
                key={doc.id}
                onClick={() => setActive(doc.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                  activeDocumentId === doc.id
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:bg-gray-900 hover:text-gray-200'
                }`}
              >
                <FileText size={14} className="flex-shrink-0" />
                <span className="truncate">{doc.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-800">
        <p className="text-xs text-gray-600 text-center">
          Powered by Claude AI
        </p>
      </div>
    </aside>
  );
}
