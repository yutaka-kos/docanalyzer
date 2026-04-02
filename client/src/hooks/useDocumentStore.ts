import { create } from 'zustand';
import type { Document, AnalysisResults } from '../types';

interface DocumentState {
  documents: Document[];
  activeDocumentId: string | null;
  isUploading: boolean;
  analysisResults: Record<string, AnalysisResults>;
  addDocument: (doc: Document) => void;
  setActive: (id: string) => void;
  setUploading: (v: boolean) => void;
  setAnalysis: (docId: string, results: Partial<AnalysisResults>) => void;
  getActiveDocument: () => Document | undefined;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  documents: [],
  activeDocumentId: null,
  isUploading: false,
  analysisResults: {},

  addDocument: (doc) =>
    set((state) => ({
      documents: [...state.documents, doc],
      activeDocumentId: doc.id,
    })),

  setActive: (id) => set({ activeDocumentId: id }),

  setUploading: (v) => set({ isUploading: v }),

  setAnalysis: (docId, results) =>
    set((state) => ({
      analysisResults: {
        ...state.analysisResults,
        [docId]: { ...state.analysisResults[docId], ...results },
      },
    })),

  getActiveDocument: () => {
    const { documents, activeDocumentId } = get();
    return documents.find((d) => d.id === activeDocumentId);
  },
}));
