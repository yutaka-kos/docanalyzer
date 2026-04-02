import { useState, useRef, type KeyboardEvent } from 'react';
import { Send } from 'lucide-react';

export function ChatInput({ onSend, disabled }: { onSend: (msg: string) => void; disabled: boolean }) {
  const [input, setInput] = useState('');
  const composingRef = useRef(false);

  const handleSend = () => {
    const msg = input.trim();
    if (!msg || disabled) return;
    onSend(msg);
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !composingRef.current) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex gap-2 p-4 border-t border-gray-800">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => { composingRef.current = true; }}
        onCompositionEnd={() => { composingRef.current = false; }}
        placeholder="Ask a question about the document..."
        rows={1}
        className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 outline-none focus:border-blue-500 resize-none"
        disabled={disabled}
      />
      <button
        onClick={handleSend}
        disabled={disabled || !input.trim()}
        className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
      >
        <Send size={16} />
      </button>
    </div>
  );
}
