import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { parsePdf } from '../../lib/pdfParser';
import { splitIntoChunks } from '../../lib/chunker';
import { getEmbeddings } from '../../lib/api';
import { vectorStore } from '../../lib/vectorStore';
import { useDocumentStore } from '../../hooks/useDocumentStore';

export function FileUploader({ onDone }: { onDone: () => void }) {
  const [status, setStatus] = useState('');
  const [processing, setProcessing] = useState(false);
  const { addDocument, setUploading } = useDocumentStore();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setProcessing(true);
    setUploading(true);

    try {
      // Extract text
      setStatus('Extracting text...');
      let text: string;
      if (file.name.endsWith('.pdf')) {
        text = await parsePdf(file);
      } else {
        text = await file.text();
      }

      // Chunk
      setStatus('Splitting into chunks...');
      const chunks = splitIntoChunks(text);

      // Vectorize
      setStatus('Vectorizing chunks...');
      const vectors = await getEmbeddings(chunks.map((c) => c.text));

      // Store
      vectorStore.addChunks(chunks, vectors);

      const doc = {
        id: `doc_${Date.now()}`,
        name: file.name,
        text,
        chunks,
        vectors,
        createdAt: Date.now(),
      };

      addDocument(doc);
      setStatus('Done!');
      setTimeout(onDone, 500);
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setProcessing(false);
      setUploading(false);
    }
  }, [addDocument, setUploading, onDone]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
    },
    maxFiles: 1,
    disabled: processing,
  });

  return (
    <div className="flex-1 flex items-center justify-center">
      <div
        {...getRootProps()}
        className={`w-full max-w-lg border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${
          isDragActive
            ? 'border-blue-500 bg-blue-500/5'
            : 'border-gray-700 hover:border-gray-600 hover:bg-gray-900/50'
        } ${processing ? 'pointer-events-none opacity-60' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-4">
          {processing ? (
            <Loader2 size={40} className="text-blue-500 animate-spin" />
          ) : isDragActive ? (
            <Upload size={40} className="text-blue-400" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center">
              <FileText size={24} className="text-gray-400" />
            </div>
          )}
          <div>
            <p className="text-lg font-medium text-gray-200">
              {processing ? status : isDragActive ? 'Drop file here' : 'Drop your document here'}
            </p>
            {!processing && (
              <p className="text-sm text-gray-500 mt-1">
                PDF, TXT, or Markdown files supported
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
