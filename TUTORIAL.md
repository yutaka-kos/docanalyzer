# DocAnalyzer 自力構築チュートリアル

このチュートリアルを上から順にやれば、助けなしでDocAnalyzerを0から作れます。
コピペではなく「なぜこう書くのか」を理解しながら進めてください。

---

## 前提

- Node.js v18以上がインストール済み
- Claude APIキーを持っている
- ターミナルの基本操作ができる

---

## Phase 1: プロジェクトの器を作る（30分）

### 1-1. フォルダを作る

```bash
mkdir docanalyzer
cd docanalyzer
```

### 1-2. フロントエンドを生成する

```bash
npm create vite@latest client -- --template react-ts
cd client
npm install
```

**何が起きた？**
→ `client/` フォルダにReact + TypeScriptのテンプレートが生成された。
→ `npm install` で必要なパッケージがダウンロードされた。

試しに動かしてみる：
```bash
npm run dev
```
→ ブラウザで http://localhost:5173 を開くとデモ画面が出る。確認したらCtrl+Cで止める。

### 1-3. ライブラリを追加する

```bash
npm install tailwindcss @tailwindcss/vite
npm install zustand
npm install recharts
npm install pdfjs-dist
npm install react-dropzone
npm install react-markdown remark-gfm
npm install lucide-react
npm install framer-motion
```

**1つずつ入れる理由**: エラーが出たときどれが原因かわかる。

### 1-4. vite.config.ts を編集する

`client/vite.config.ts` を開いて以下に書き換え：

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001'
    },
    headers: {
      'Content-Security-Policy': "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:; worker-src 'self' blob:;"
    }
  }
})
```

**理解ポイント:**
- `tailwindcss()` → TailwindをViteに統合
- `proxy` → `/api` で始まるリクエストをport 3001のサーバーに転送
- `headers` → pdf.jsのworkerが動くためのセキュリティ設定

### 1-5. CSSを設定する

`client/src/index.css` を以下に書き換え：

```css
@import "tailwindcss";

@theme {
  --font-sans: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
}

body {
  @apply bg-gray-950 text-gray-100 font-sans antialiased;
  margin: 0;
}

#root {
  height: 100vh;
}

::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #374151;
  border-radius: 3px;
}
```

**理解ポイント:**
- `@import "tailwindcss"` → Tailwindを読み込む
- `bg-gray-950` → ほぼ黒の背景色。ダークテーマの基本
- スクロールバーもダークに統一

### 1-6. 不要ファイルを消す

```bash
rm src/App.css
rm -rf src/assets
```

### 1-7. 動作確認

```bash
npm run dev
```
→ 真っ黒な画面が出ればOK。Ctrl+Cで止める。

---

## Phase 2: 型定義を作る（10分）

アプリで扱うデータの形を最初に決める。設計図のようなもの。

### 2-1. types/index.ts を作る

```bash
mkdir -p src/types
```

`client/src/types/index.ts` を作成：

```typescript
// ドキュメント1つ分のデータ
export interface Document {
  id: string;
  name: string;        // ファイル名
  text: string;        // 抽出されたテキスト全文
  chunks: Chunk[];     // テキストを分割したもの（RAG用）
  vectors: number[][]; // 各チャンクのベクトル（検索用）
  createdAt: number;
}

// テキストの断片（500文字くらい）
export interface Chunk {
  id: string;
  text: string;
  index: number;
}

// チャットの1メッセージ
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: Chunk[];  // AIが参照したチャンク
}

// キーワード1つ
export interface KeywordResult {
  word: string;
  score: number;       // 0.0〜1.0 重要度
  category?: string;   // トピックカテゴリ
}

// 感情分析結果（段落ごと）
export interface SentimentResult {
  paragraph: number;
  text: string;
  sentiment: number;   // -1.0〜1.0
  tone: string;        // "analytical" | "formal" | etc.
}

// 分析結果をまとめたもの
export interface AnalysisResults {
  summary?: string;
  keywords?: KeywordResult[];
  sentiment?: SentimentResult[];
}

// タブの種類
export type TabType = 'summary' | 'chat' | 'keywords' | 'sentiment';
```

**理解ポイント:**
- `interface` = データの形を定義。「Documentにはid, name, textが入ってる」と宣言
- `?` = オプショナル。あってもなくてもいい
- ここで定義した型を全コンポーネントが参照する

---

## Phase 3: 状態管理を作る（15分）

「今どのドキュメントが選ばれているか」「チャット履歴」などアプリ全体で共有するデータの管理。

### 3-1. useDocumentStore.ts

```bash
mkdir -p src/hooks
```

`client/src/hooks/useDocumentStore.ts` を作成：

```typescript
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
  // --- データ ---
  documents: [],
  activeDocumentId: null,
  isUploading: false,
  analysisResults: {},

  // --- 操作 ---
  addDocument: (doc) =>
    set((state) => ({
      documents: [...state.documents, doc],
      activeDocumentId: doc.id,  // 追加したらすぐ選択状態にする
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
```

**理解ポイント:**
- `create()` でストアを作る。中にデータと操作関数をまとめる
- `set()` でデータを更新。Reactが自動的に画面を再描画する
- `get()` で現在のデータを取得
- どのコンポーネントからでも `useDocumentStore()` で呼べる

### 3-2. useChatStore.ts

`client/src/hooks/useChatStore.ts` を作成：

```typescript
import { create } from 'zustand';
import type { ChatMessage } from '../types';

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  addMessage: (msg: ChatMessage) => void;
  updateLastAssistant: (content: string) => void;
  clearMessages: () => void;
  setStreaming: (v: boolean) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isStreaming: false,

  addMessage: (msg) =>
    set((state) => ({ messages: [...state.messages, msg] })),

  // ストリーミング中にAIの最後のメッセージを更新し続ける
  updateLastAssistant: (content) =>
    set((state) => {
      const msgs = [...state.messages];
      const lastIdx = msgs.length - 1;
      if (lastIdx >= 0 && msgs[lastIdx].role === 'assistant') {
        msgs[lastIdx] = { ...msgs[lastIdx], content };
      }
      return { messages: msgs };
    }),

  clearMessages: () => set({ messages: [] }),
  setStreaming: (v) => set({ isStreaming: v }),
}));
```

**理解ポイント:**
- `updateLastAssistant` が重要。AIの回答は1文字ずつ届くので、最後のメッセージを何度も上書きする
- これでチャットがリアルタイムに文字が増えていくように見える

---

## Phase 4: 共通UIパーツを作る（15分）

何度も使い回す小さな部品を先に作る。

### 4-1. ディレクトリ作成

```bash
mkdir -p src/components/ui
```

### 4-2. Button.tsx

`client/src/components/ui/Button.tsx`:

```typescript
import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md';
  children: ReactNode;
}

export function Button({ variant = 'primary', size = 'md', children, className = '', ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
  };
  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-500 text-white',
    secondary: 'bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700',
    ghost: 'hover:bg-gray-800 text-gray-400 hover:text-gray-200',
  };

  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
```

**理解ポイント:**
- `variant` で見た目を切り替える。使う側は `<Button variant="primary">` と書くだけ
- `...props` で `onClick` 等の標準属性をそのまま受け渡す

### 4-3. Card.tsx

`client/src/components/ui/Card.tsx`:

```typescript
import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-xl p-5 ${className}`}>
      {children}
    </div>
  );
}
```

### 4-4. Spinner.tsx

`client/src/components/ui/Spinner.tsx`:

```typescript
export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg className="animate-spin text-blue-500" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
```

### 4-5. Tabs.tsx

`client/src/components/ui/Tabs.tsx`:

```typescript
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
```

### 4-6. Badge.tsx

`client/src/components/ui/Badge.tsx`:

```typescript
import type { ReactNode } from 'react';

export function Badge({ children, color = 'blue' }: { children: ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md border ${colors[color] || colors.blue}`}>
      {children}
    </span>
  );
}
```

---

## Phase 5: レイアウトを組む（20分）

画面の枠を作る。中身はまだ空でOK。

### 5-1. ディレクトリ作成

```bash
mkdir -p src/components/layout
```

### 5-2. Sidebar.tsx

`client/src/components/layout/Sidebar.tsx`:

```typescript
import { FileText, Plus } from 'lucide-react';
import { useDocumentStore } from '../../hooks/useDocumentStore';

export function Sidebar({ onUploadClick }: { onUploadClick: () => void }) {
  const { documents, activeDocumentId, setActive } = useDocumentStore();

  return (
    <aside className="w-64 h-full bg-gray-950 border-r border-gray-800 flex flex-col">
      {/* ロゴ + アップロードボタン */}
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

      {/* ドキュメント一覧 */}
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
        <p className="text-xs text-gray-600 text-center">Powered by Claude AI</p>
      </div>
    </aside>
  );
}
```

**理解ポイント:**
- `useDocumentStore()` でストアからデータと関数を取り出す
- `documents.map()` でドキュメント一覧を動的に描画
- `activeDocumentId === doc.id` で選択中のアイテムだけ色を変える

### 5-3. Header.tsx

`client/src/components/layout/Header.tsx`:

```typescript
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
```

### 5-4. MainPanel.tsx

`client/src/components/layout/MainPanel.tsx`:

```typescript
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
    if (showUpload) return <FileUploader onDone={onCloseUpload} />;

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
      case 'summary': return <SummaryView />;
      case 'chat': return <ChatPanel />;
      case 'keywords': return <KeywordCloud />;
      case 'sentiment': return <SentimentChart />;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 overflow-y-auto p-6">{renderContent()}</div>
    </div>
  );
}
```

**理解ポイント:**
- `switch` でアクティブなタブに応じて表示するコンポーネントを切り替え
- この時点ではFileUploader等はまだ作っていないが、先にimportを書いておく

### 5-5. App.tsx を書き換え

`client/src/App.tsx`:

```typescript
import { useState } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { MainPanel } from './components/layout/MainPanel';

function App() {
  const [showUpload, setShowUpload] = useState(false);

  return (
    <div className="flex h-screen bg-gray-950">
      <Sidebar onUploadClick={() => setShowUpload(true)} />
      <MainPanel showUpload={showUpload} onCloseUpload={() => setShowUpload(false)} />
    </div>
  );
}

export default App;
```

**ここまでのゴール:** 左にサイドバー、右にメインパネルの2カラムレイアウトが表示される（中身の機能はまだ動かない）。

---

## Phase 6: ユーティリティを作る（20分）

データの処理や通信を行う関数群。

### 6-1. ディレクトリ作成

```bash
mkdir -p src/lib
```

### 6-2. pdfParser.ts — PDF→テキスト

`client/src/lib/pdfParser.ts`:

```typescript
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// PDFの解析はCPUを使うので別スレッド（Worker）で処理する
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export async function parsePdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    // テキストアイテムを位置情報を見ながら結合
    let lastY: number | null = null;
    let lineText = '';
    const lines: string[] = [];

    for (const item of content.items as any[]) {
      if (!item.str) continue;
      const y = Math.round(item.transform[5]); // Y座標

      if (lastY !== null && Math.abs(y - lastY) > 5) {
        // Y座標が変わった = 新しい行
        if (lineText.trim()) lines.push(lineText.trim());
        lineText = item.str;
      } else {
        // 同じ行の続き
        if (lineText && !lineText.endsWith(' ') && !item.str.startsWith(' ')) {
          const lastChar = lineText[lineText.length - 1];
          const firstChar = item.str[0];
          const isJapanese = /[\u3000-\u9fff\uf900-\ufaff]/.test(lastChar) ||
                             /[\u3000-\u9fff\uf900-\ufaff]/.test(firstChar);
          lineText += isJapanese ? item.str : ' ' + item.str;
        } else {
          lineText += item.str;
        }
      }
      lastY = y;
    }
    if (lineText.trim()) lines.push(lineText.trim());
    pages.push(lines.join('\n'));
  }

  return pages.join('\n\n');
}
```

**理解ポイント:**
- PDFは「座標(x,y)に文字列を配置」という形式で中身を持っている
- Y座標が変わったら改行と判断する
- 日本語の場合はスペースを入れない（英語はスペースで単語を区切る）

### 6-3. chunker.ts — テキスト分割

`client/src/lib/chunker.ts`:

```typescript
import type { Chunk } from '../types';

export function splitIntoChunks(text: string, maxChars = 1500, overlap = 200): Chunk[] {
  // 文の区切りで分割
  const sentences = text.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) || [text];
  const chunks: Chunk[] = [];
  let current = '';
  let index = 0;

  for (const sentence of sentences) {
    if (current.length + sentence.length > maxChars && current.length > 0) {
      // maxCharsを超えたら1チャンクとして確定
      chunks.push({ id: `chunk_${index}`, text: current.trim(), index });

      // 前のチャンクの末尾をオーバーラップとして次に含める
      const words = current.split(' ');
      const overlapWords = words.slice(-Math.ceil(overlap / 5));
      current = overlapWords.join(' ') + ' ' + sentence;
      index++;
    } else {
      current += sentence;
    }
  }

  if (current.trim()) {
    chunks.push({ id: `chunk_${index}`, text: current.trim(), index });
  }

  return chunks;
}
```

**理解ポイント:**
- RAGでは長い文書をそのままAIに渡せない。小さなチャンクに分割する
- オーバーラップ = チャンクの境界で文脈が切れないよう、前後を少し重ねる

### 6-4. cosine.ts — コサイン類似度

`client/src/lib/cosine.ts`:

```typescript
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];       // 内積
    normA += a[i] * a[i];     // ベクトルAの大きさ
    normB += b[i] * b[i];     // ベクトルBの大きさ
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;  // -1〜1の値
}
```

**理解ポイント:**
- 2つのベクトルの「向きの近さ」を測る。1に近いほど似ている
- 質問のベクトルとチャンクのベクトルを比べて、関連するチャンクを見つける

### 6-5. vectorStore.ts — ベクトル検索

`client/src/lib/vectorStore.ts`:

```typescript
import type { Chunk } from '../types';
import { cosineSimilarity } from './cosine';

export class VectorStore {
  private chunks: Chunk[] = [];
  private vectors: number[][] = [];

  addChunks(chunks: Chunk[], vectors: number[][]) {
    this.chunks = chunks;
    this.vectors = vectors;
  }

  // クエリに最も似ているチャンクをtopK個返す
  search(queryVector: number[], topK = 3): Chunk[] {
    if (this.chunks.length === 0) return [];

    const scores = this.chunks.map((chunk, i) => ({
      chunk,
      score: cosineSimilarity(queryVector, this.vectors[i]),
    }));

    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK).map((s) => s.chunk);
  }

  clear() {
    this.chunks = [];
    this.vectors = [];
  }
}

export const vectorStore = new VectorStore();
```

### 6-6. api.ts — サーバー通信

`client/src/lib/api.ts`:

```typescript
import type { KeywordResult, SentimentResult } from '../types';

// SSEデータを安全にパースする
function parseSSEData(data: string): string {
  if (data === '[DONE]') return '';
  try { return JSON.parse(data); }
  catch { return data; }
}

// SSEストリームを読む共通関数
async function* readSSEStream(res: Response): AsyncGenerator<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';  // 不完全な行はバッファに残す

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);     // "data: " の後ろを取り出す
        if (data === '[DONE]') return;
        const parsed = parseSSEData(data);
        if (parsed) yield parsed;       // 1チャンクずつ呼び出し元に返す
      }
    }
  }
}

// 要約ストリーミング
export async function* streamSummary(text: string): AsyncGenerator<string> {
  const res = await fetch('/api/analyze/summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error('Failed to generate summary');
  yield* readSSEStream(res);
}

// チャットストリーミング
export async function* streamChat(
  messages: { role: string; content: string }[],
  context: string
): AsyncGenerator<string> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, context }),
  });
  if (!res.ok) throw new Error('Failed to get chat response');
  yield* readSSEStream(res);
}

// キーワード抽出（一括）
export async function extractKeywords(text: string): Promise<KeywordResult[]> {
  const res = await fetch('/api/analyze/keywords', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error('Failed to extract keywords');
  return res.json();
}

// 感情分析（一括）
export async function analyzeSentiment(text: string): Promise<SentimentResult[]> {
  const res = await fetch('/api/analyze/sentiment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error('Failed to analyze sentiment');
  return res.json();
}

// ベクトル化
export async function getEmbeddings(chunks: string[]): Promise<number[][]> {
  const res = await fetch('/api/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chunks }),
  });
  if (!res.ok) throw new Error('Failed to get embeddings');
  return res.json();
}
```

**理解ポイント:**
- `async function*` = 非同期ジェネレータ。`yield` で値を1つずつ返す
- `yield*` = 別のジェネレータに処理を委譲する
- SSEではサーバーが `data: テキスト\n\n` の形式でデータを送ってくる

---

## Phase 7: 機能コンポーネントを作る（40分）

### 7-1. ディレクトリ作成

```bash
mkdir -p src/components/{upload,summary,chat,keywords,sentiment}
```

### 7-2. FileUploader.tsx

`client/src/components/upload/FileUploader.tsx`:

```typescript
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
      // 1. テキスト抽出
      setStatus('Extracting text...');
      let text: string;
      if (file.name.endsWith('.pdf')) {
        text = await parsePdf(file);
      } else {
        text = await file.text();
      }

      // 2. チャンク分割
      setStatus('Splitting into chunks...');
      const chunks = splitIntoChunks(text);

      // 3. ベクトル化
      setStatus('Vectorizing chunks...');
      const vectors = await getEmbeddings(chunks.map((c) => c.text));

      // 4. 保存
      vectorStore.addChunks(chunks, vectors);
      addDocument({
        id: `doc_${Date.now()}`,
        name: file.name,
        text, chunks, vectors,
        createdAt: Date.now(),
      });

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
    accept: { 'application/pdf': ['.pdf'], 'text/plain': ['.txt'], 'text/markdown': ['.md'] },
    maxFiles: 1,
    disabled: processing,
  });

  return (
    <div className="flex-1 flex items-center justify-center">
      <div
        {...getRootProps()}
        className={`w-full max-w-lg border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${
          isDragActive ? 'border-blue-500 bg-blue-500/5' : 'border-gray-700 hover:border-gray-600 hover:bg-gray-900/50'
        } ${processing ? 'pointer-events-none opacity-60' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-4">
          {processing ? (
            <Loader2 size={40} className="text-blue-500 animate-spin" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center">
              <FileText size={24} className="text-gray-400" />
            </div>
          )}
          <p className="text-lg font-medium text-gray-200">
            {processing ? status : isDragActive ? 'Drop file here' : 'Drop your document here'}
          </p>
          {!processing && <p className="text-sm text-gray-500 mt-1">PDF, TXT, or Markdown</p>}
        </div>
      </div>
    </div>
  );
}
```

### 7-3. SummaryView.tsx

`client/src/components/summary/SummaryView.tsx`:

```typescript
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
      // ストリーミングで1チャンクずつ受け取る
      for await (const chunk of streamSummary(doc.text)) {
        fullText += chunk;
        setStreamedText(fullText);  // 画面を逐次更新
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
            <Button variant="ghost" size="sm" onClick={handleGenerate}>Regenerate</Button>
          )}
        </>
      )}
    </div>
  );
}
```

### 7-4. ChatInput.tsx

`client/src/components/chat/ChatInput.tsx`:

```typescript
import { useState, useRef, type KeyboardEvent } from 'react';
import { Send } from 'lucide-react';

export function ChatInput({ onSend, disabled }: { onSend: (msg: string) => void; disabled: boolean }) {
  const [input, setInput] = useState('');
  const composingRef = useRef(false);  // 日本語変換中かどうか

  const handleSend = () => {
    const msg = input.trim();
    if (!msg || disabled) return;
    onSend(msg);
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    // 変換中でなければEnterで送信
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
```

### 7-5. ChatMessage.tsx

`client/src/components/chat/ChatMessage.tsx`:

```typescript
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { User, Bot } from 'lucide-react';
import type { ChatMessage as ChatMessageType } from '../../types';

export function ChatMessage({ message }: { message: ChatMessageType }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
        isUser ? 'bg-blue-600' : 'bg-gray-800'
      }`}>
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>
      <div className={`max-w-[80%] rounded-xl px-4 py-3 ${
        isUser ? 'bg-blue-600 text-white' : 'bg-gray-900 border border-gray-800 text-gray-200'
      }`}>
        <div className="prose prose-invert prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        </div>
        {message.sources && message.sources.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-700">
            <p className="text-xs text-gray-500 mb-1">Sources:</p>
            {message.sources.map((s) => (
              <p key={s.id} className="text-xs text-gray-500 truncate">
                Chunk {s.index + 1}: {s.text.slice(0, 80)}...
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

### 7-6. ChatPanel.tsx

`client/src/components/chat/ChatPanel.tsx`:

```typescript
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

  // メッセージが増えたら自動スクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!doc) return null;

  const handleSend = async (text: string) => {
    addMessage({ role: 'user', content: text });
    setStreaming(true);

    try {
      // 1. 質問をベクトル化
      const [queryVector] = await getEmbeddings([text]);

      // 2. 関連チャンクを検索（RAG）
      const relevantChunks: Chunk[] = vectorStore.search(queryVector, 3);
      const context = relevantChunks.map((c) => c.text).join('\n\n---\n\n');

      // 3. 空のAIメッセージを追加（ここに文字が流れ込む）
      addMessage({ role: 'assistant', content: '', sources: relevantChunks });

      // 4. ストリーミングで回答を受け取る
      let fullText = '';
      const chatHistory = messages.map((m) => ({ role: m.role, content: m.content }));
      chatHistory.push({ role: 'user', content: text });

      for await (const chunk of streamChat(chatHistory, context)) {
        fullText += chunk;
        updateLastAssistant(fullText);  // リアルタイム更新
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
```

### 7-7. KeywordCloud.tsx

`client/src/components/keywords/KeywordCloud.tsx`:

```typescript
import { useState } from 'react';
import { Tags, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useDocumentStore } from '../../hooks/useDocumentStore';
import { extractKeywords } from '../../lib/api';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

const colors = [
  'text-blue-400', 'text-purple-400', 'text-cyan-400',
  'text-emerald-400', 'text-amber-400', 'text-rose-400',
];

export function KeywordCloud() {
  const doc = useDocumentStore((s) => s.getActiveDocument());
  const analysisResults = useDocumentStore((s) => s.analysisResults);
  const setAnalysis = useDocumentStore((s) => s.setAnalysis);
  const [isLoading, setIsLoading] = useState(false);

  if (!doc) return null;
  const keywords = analysisResults[doc.id]?.keywords;

  const handleExtract = async () => {
    setIsLoading(true);
    try {
      const results = await extractKeywords(doc.text);
      setAnalysis(doc.id, { keywords: results });
    } catch (err) { console.error(err); }
    finally { setIsLoading(false); }
  };

  if (!keywords && !isLoading) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card className="text-center py-12">
          <Tags size={32} className="text-blue-400 mx-auto mb-4" />
          <p className="text-gray-300 mb-4">Extract key topics and themes</p>
          <Button onClick={handleExtract}>Extract Keywords</Button>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-blue-500" />
        <span className="ml-2 text-gray-400 text-sm">Extracting keywords...</span>
      </div>
    );
  }

  const maxScore = Math.max(...(keywords || []).map((k) => k.score));

  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <div className="flex flex-wrap gap-3 justify-center py-4">
          {keywords?.map((kw, i) => {
            const ratio = kw.score / maxScore;
            const fontSize = 14 + ratio * 28;  // スコアに応じてサイズ変動
            return (
              <motion.div
                key={kw.word}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className={`px-3 py-1.5 rounded-full bg-gray-800/50 border border-gray-700/50 cursor-default ${colors[i % colors.length]}`}
                style={{ fontSize: `${fontSize}px` }}
                title={`Score: ${kw.score.toFixed(2)}`}
              >
                {kw.word}
              </motion.div>
            );
          })}
        </div>
      </Card>
      <Button variant="ghost" size="sm" onClick={handleExtract} className="mt-4">Re-extract</Button>
    </div>
  );
}
```

### 7-8. SentimentChart.tsx

`client/src/components/sentiment/SentimentChart.tsx`:

```typescript
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

const COLORS = { positive: '#22c55e', negative: '#ef4444', neutral: '#6b7280' };

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
    } catch (err) { console.error(err); }
    finally { setIsLoading(false); }
  };

  if (!sentiment && !isLoading) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card className="text-center py-12">
          <BarChart3 size={32} className="text-blue-400 mx-auto mb-4" />
          <p className="text-gray-300 mb-4">Analyze emotional tone and sentiment</p>
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

  // グラフ用データ加工
  const areaData = sentiment?.map((s, i) => ({ paragraph: `P${i + 1}`, sentiment: s.sentiment }));

  const positive = sentiment?.filter((s) => s.sentiment > 0.1).length || 0;
  const negative = sentiment?.filter((s) => s.sentiment < -0.1).length || 0;
  const neutral = (sentiment?.length || 0) - positive - negative;
  const pieData = [
    { name: 'Positive', value: positive, color: COLORS.positive },
    { name: 'Negative', value: negative, color: COLORS.negative },
    { name: 'Neutral', value: neutral, color: COLORS.neutral },
  ];

  const tones: Record<string, number> = {};
  sentiment?.forEach((s) => { tones[s.tone] = (tones[s.tone] || 0) + 1; });
  const radarData = Object.entries(tones).map(([tone, count]) => ({
    tone, count, fullMark: sentiment?.length || 1,
  }));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 感情の推移 */}
      <Card>
        <h3 className="text-sm font-medium text-gray-400 mb-4">Sentiment Flow</h3>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={areaData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="paragraph" tick={{ fill: '#6b7280', fontSize: 12 }} />
            <YAxis domain={[-1, 1]} tick={{ fill: '#6b7280', fontSize: 12 }} />
            <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
            <defs>
              <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="sentiment" stroke="#3b82f6" fill="url(#sg)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        {/* 円グラフ */}
        <Card>
          <h3 className="text-sm font-medium text-gray-400 mb-4">Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" strokeWidth={0}>
                {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
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

        {/* レーダーチャート */}
        <Card>
          <h3 className="text-sm font-medium text-gray-400 mb-4">Tone</h3>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#374151" />
              <PolarAngleAxis dataKey="tone" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <PolarRadiusAxis tick={false} axisLine={false} />
              <Radar dataKey="count" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Button variant="ghost" size="sm" onClick={handleAnalyze}>Re-analyze</Button>
    </div>
  );
}
```

**ここまでのゴール:** フロントエンド完成。`npm run dev` で画面が表示される（サーバーがないのでAPI通信はエラーになる）。

---

## Phase 8: サーバーを作る（30分）

### 8-1. サーバーのプロジェクト作成

docanalyzerのルートに戻って：

```bash
cd ..  # docanalyzer/ に戻る
mkdir -p server/src/routes server/src/lib
cd server
```

`server/package.json` を作成：

```json
{
  "name": "docanalyzer-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts"
  }
}
```

```bash
npm install express cors dotenv @anthropic-ai/sdk
npm install -D typescript tsx @types/express @types/cors @types/node
```

### 8-2. tsconfig.json

`server/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

### 8-3. .env

`server/.env`:

```
ANTHROPIC_API_KEY=ここにあなたのAPIキーを貼る
```

### 8-4. claude.ts — Claude API呼び出し

`server/src/lib/claude.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();  // 環境変数 ANTHROPIC_API_KEY を自動で読む

// ストリーミング（要約、チャット用）
export async function streamMessage(systemPrompt: string, userMessage: string) {
  return client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });
}

// 一括（キーワード、感情分析用）
export async function createMessage(systemPrompt: string, userMessage: string): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });
  const block = response.content[0];
  return block.type === 'text' ? block.text : '';
}

// チャット用（履歴付き）
export async function streamChat(
  systemPrompt: string,
  messages: { role: string; content: string }[]
) {
  return client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: messages as any,
  });
}
```

### 8-5. prompts.ts — AIへの指示文

`server/src/lib/prompts.ts`:

```typescript
export const SUMMARY_PROMPT = `あなたはドキュメント分析AIです。提供されたドキュメントの包括的な要約を日本語で生成してください。

以下の構成でマークダウン形式で回答してください：
1. **一行要約**: ドキュメントの本質を一文で表現
2. **詳細要約**: 主要なポイントを3〜5段落でカバー
3. **重要ポイント**: 最も重要な発見や内容を箇条書きで記述

正確で簡潔、かつ洞察力のある要約を心がけてください。必ず日本語で回答してください。`;

export const KEYWORDS_PROMPT = `あなたはキーワード抽出AIです。提供されたドキュメントを分析し、最も重要なキーワードとトピックを抽出してください。

以下の正確なJSON形式で配列を返してください：
[
  {"word": "キーワード", "score": 0.95, "category": "トピックカテゴリ"},
  ...
]

ルール：
- 15〜25個のキーワードを抽出すること
- スコアは0.0〜1.0の範囲（1.0が最も重要）
- カテゴリは「技術」「ビジネス」「科学」「医学」「法律」「教育」などの大まかなトピック
- JSON配列のみを返し、それ以外のテキストは含めないこと`;

export const SENTIMENT_PROMPT = `あなたは感情分析AIです。提供されたドキュメントの各段落の感情的なトーンを分析してください。

以下の正確なJSON形式で配列を返してください：
[
  {"paragraph": 1, "text": "段落の最初の50文字...", "sentiment": 0.5, "tone": "analytical"},
  ...
]

ルール：
- sentimentは-1.0（非常にネガティブ）から1.0（非常にポジティブ）の範囲
- toneは以下のいずれか: "analytical", "formal", "casual", "emotional", "technical", "persuasive", "narrative", "critical"
- JSON配列のみを返し、それ以外のテキストは含めないこと`;

export const QA_PROMPT = `あなたはドキュメントQ&Aアシスタントです。提供されたコンテキストのみに基づいて、ユーザーの質問に日本語で回答してください。

ドキュメントからのコンテキスト：
---
{context}
---

ルール：
- 提供されたコンテキストのみに基づいて回答すること
- コンテキストに十分な情報がない場合は、その旨を明確に伝えること
- 簡潔かつ的確に回答すること
- 必ず日本語で回答すること`;
```

### 8-6. tfidf.ts — ベクトル化

`server/src/lib/tfidf.ts`:

```typescript
export class TfIdfVectorizer {
  private vocabulary: Map<string, number> = new Map();
  private idf: Map<string, number> = new Map();

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s\u3000-\u9fff\uf900-\ufaff]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1);
  }

  fit(documents: string[]) {
    const df: Map<string, number> = new Map();

    for (const doc of documents) {
      const tokens = new Set(this.tokenize(doc));
      for (const token of tokens) {
        df.set(token, (df.get(token) || 0) + 1);
      }
    }

    // 上位1000語に絞る（ベクトルの次元数を抑える）
    const sorted = [...df.entries()].sort((a, b) => b[1] - a[1]).slice(0, 1000);

    this.vocabulary.clear();
    this.idf.clear();
    sorted.forEach(([token, count], i) => {
      this.vocabulary.set(token, i);
      this.idf.set(token, Math.log(documents.length / (1 + count)));
    });
  }

  transform(documents: string[]): number[][] {
    return documents.map((doc) => {
      const tokens = this.tokenize(doc);
      const tf: Map<string, number> = new Map();
      for (const token of tokens) {
        tf.set(token, (tf.get(token) || 0) + 1);
      }

      const vector = new Array(this.vocabulary.size).fill(0);
      for (const [token, freq] of tf) {
        const idx = this.vocabulary.get(token);
        if (idx !== undefined) {
          vector[idx] = (freq / tokens.length) * (this.idf.get(token) || 0);
        }
      }
      return vector;
    });
  }

  fitTransform(documents: string[]): number[][] {
    this.fit(documents);
    return this.transform(documents);
  }
}

export const vectorizer = new TfIdfVectorizer();
```

### 8-7. routes/analyze.ts

`server/src/routes/analyze.ts`:

```typescript
import { Router } from 'express';
import { streamMessage, createMessage } from '../lib/claude.js';
import { SUMMARY_PROMPT, KEYWORDS_PROMPT, SENTIMENT_PROMPT } from '../lib/prompts.js';

const router = Router();

// 要約（ストリーミング）
router.post('/summary', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });

    // SSEヘッダー設定
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await streamMessage(SUMMARY_PROMPT, text.slice(0, 100000));

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        // JSON.stringifyで改行を安全にエスケープ
        res.write(`data: ${JSON.stringify(event.delta.text)}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: any) {
    console.error('Summary error:', err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// キーワード
router.post('/keywords', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });

    const result = await createMessage(KEYWORDS_PROMPT, text.slice(0, 100000));
    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return res.status(500).json({ error: 'Failed to parse' });
    res.json(JSON.parse(jsonMatch[0]));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 感情分析
router.post('/sentiment', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });

    const result = await createMessage(SENTIMENT_PROMPT, text.slice(0, 100000));
    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return res.status(500).json({ error: 'Failed to parse' });
    res.json(JSON.parse(jsonMatch[0]));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
```

### 8-8. routes/chat.ts

`server/src/routes/chat.ts`:

```typescript
import { Router } from 'express';
import { streamChat } from '../lib/claude.js';
import { QA_PROMPT } from '../lib/prompts.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const { messages, context } = req.body;
    if (!messages || !context) return res.status(400).json({ error: 'messages and context required' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const systemPrompt = QA_PROMPT.replace('{context}', context);
    const stream = await streamChat(systemPrompt, messages);

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify(event.delta.text)}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: any) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

export default router;
```

### 8-9. routes/embed.ts

`server/src/routes/embed.ts`:

```typescript
import { Router } from 'express';
import { vectorizer } from '../lib/tfidf.js';

const router = Router();

router.post('/', (req, res) => {
  try {
    const { chunks } = req.body;
    if (!chunks || !Array.isArray(chunks)) return res.status(400).json({ error: 'chunks required' });

    const vectors = vectorizer.fitTransform(chunks);
    res.json(vectors);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
```

### 8-10. index.ts — サーバー起動

`server/src/index.ts`:

```typescript
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import analyzeRouter from './routes/analyze.js';
import chatRouter from './routes/chat.js';
import embedRouter from './routes/embed.js';

const app = express();

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '10mb' }));

app.use('/api/analyze', analyzeRouter);
app.use('/api/chat', chatRouter);
app.use('/api/embed', embedRouter);

app.listen(3001, () => {
  console.log('Server running on http://localhost:3001');
});
```

---

## Phase 9: 動かす

### ターミナル1（サーバー）
```bash
cd server
npm run dev
# → "Server running on http://localhost:3001" と出ればOK
```

### ターミナル2（フロントエンド）
```bash
cd client
npm run dev
# → ブラウザで http://localhost:5173 を開く
```

### 動作確認
1. 「Upload Document」→ PDFをドロップ
2. 「Summary」タブ → 「Generate Summary」→ ストリーミングで要約が出る
3. 「Q&A Chat」タブ → 質問を入力 → AIが文書に基づいて回答
4. 「Keywords」タブ → バブルクラウドが表示
5. 「Sentiment」タブ → グラフが表示

---

## よくあるエラーと対処

| エラー | 原因 | 対処 |
|--------|------|------|
| `CORS error` | サーバーが起動していない | サーバーを `npm run dev` で起動 |
| `401 Unauthorized` | APIキーが間違っている | `.env` のキーを確認 |
| `pdf.worker 404` | workerのパスが違う | `?url` suffixをつけてimportしているか確認 |
| 日本語変換でEnter送信 | IME対策なし | `onCompositionStart/End` を実装 |
| 要約が途切れる | SSEの改行問題 | `JSON.stringify` でエスケープ |
| `Cannot find module` | `.js` 拡張子忘れ | サーバーのimportは `.js` が必要 |

---

## 完成！

ここまでできたら、このアプリの仕組みを人に説明できるはず。
面接では「なぜこの技術を選んだか」「どこで詰まって、どう解決したか」を話せるのが大事。
