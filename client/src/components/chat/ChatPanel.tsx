import { useRef, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { useChatStore } from '../../hooks/useChatStore';
import { useDocumentStore } from '../../hooks/useDocumentStore';
import { streamChat, getEmbeddings } from '../../lib/api';
import { vectorStore } from '../../lib/vectorStore';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import type { Chunk } from '../../types';

export function ChatPanel() {
  const doc = useDocumentStore((s) => s.getActiveDocument());
  const { messages, isStreaming, addMessage, updateLastAssistant, setStreaming } = useChatStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!doc) return null;

  const handleSend = async (text: string) => {
    addMessage({ role: 'user', content: text });

    setStreaming(true);

    try {
      // RAG: search relevant chunks
      const [queryVector] = await getEmbeddings([text]);
      const relevantChunks: Chunk[] = vectorStore.search(queryVector, 3);
      const context = relevantChunks.map((c) => c.text).join('\n\n---\n\n');

      // Start assistant message
      addMessage({ role: 'assistant', content: '', sources: relevantChunks });

      let fullText = '';
      const chatHistory = messages.map((m) => ({ role: m.role, content: m.content }));
      chatHistory.push({ role: 'user', content: text });

      for await (const chunk of streamChat(chatHistory, context)) {
        fullText += chunk;
        updateLastAssistant(fullText);
      }
    } catch (err: any) {
      addMessage({ role: 'assistant', content: `Error: ${err.message}` });
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="flex flex-col h-full -m-6">
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3">
            <MessageSquare size={32} className="text-gray-600" />
            <p className="text-sm">Ask questions about your document</p>
            <p className="text-xs text-gray-600">Uses RAG to find relevant sections</p>
          </div>
        ) : (
          messages.map((msg, i) => <ChatMessage key={i} message={msg} />)
        )}
        <div ref={bottomRef} />
      </div>
      <ChatInput onSend={handleSend} disabled={isStreaming} />
    </div>
  );
}
