# DocAnalyzer - ゼロから完成までの全記録

## 全体像

```
PDFをアップロード → テキスト抽出 → AIが分析 → 結果をグラフやチャットで表示
```

```
┌──────────────────────────────────────────────────┐
│  ブラウザ (React)                                  │
│  ┌──────────┐ ┌──────────────────────────────┐   │
│  │ Sidebar  │ │ MainPanel                     │   │
│  │ ・文書一覧│ │ ・要約 / チャット / キーワード │   │
│  │ ・Upload │ │ ・感情分析グラフ               │   │
│  └──────────┘ └──────────────────────────────┘   │
└──────────────┬───────────────────────────────────┘
               │ HTTP (fetch)
┌──────────────▼───────────────────────────────────┐
│  サーバー (Express)                                │
│  ・Claude APIにリクエストを中継                     │
│  ・APIキーを安全に管理                             │
└──────────────┬───────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────┐
│  Claude API (Anthropic)                           │
│  ・要約生成 / Q&A回答 / キーワード抽出 / 感情分析  │
└──────────────────────────────────────────────────┘
```

---

## Step 1: プロジェクト作成

### フロントエンド (client/)

```bash
# Viteでreact + TypeScriptのプロジェクトを生成
npm create vite@latest client -- --template react-ts
cd client
npm install

# 必要なライブラリを追加
npm install tailwindcss @tailwindcss/vite    # CSSフレームワーク
npm install zustand                          # 状態管理（Reduxの軽量版）
npm install recharts                         # グラフ描画
npm install pdfjs-dist                       # PDFからテキスト抽出
npm install react-dropzone                   # ドラッグ&ドロップ
npm install react-markdown remark-gfm        # マークダウン表示
npm install lucide-react                     # アイコン
npm install framer-motion                    # アニメーション
```

**各ライブラリの役割:**
- `tailwindcss` → CSSをクラス名で書ける。`className="bg-gray-900 text-white"` のように
- `zustand` → アプリ全体でデータを共有する仕組み。「どの文書が選択中か」等
- `recharts` → データを渡すだけでグラフ（折れ線、円、レーダー）が描ける
- `pdfjs-dist` → PDFファイルの中身のテキストをJavaScriptで読み取る
- `react-dropzone` → ファイルをドラッグ&ドロップで受け取るUI
- `react-markdown` → AIの回答（マークダウン形式）をHTMLに変換して表示

### バックエンド (server/)

```bash
mkdir -p server/src/routes server/src/lib
cd server
npm init -y

# サーバー用ライブラリ
npm install express         # Webサーバー
npm install cors            # ブラウザからのアクセスを許可
npm install dotenv          # .envファイルから環境変数を読む
npm install @anthropic-ai/sdk  # Claude API公式SDK

# 開発用
npm install -D typescript tsx @types/express @types/cors @types/node
```

**なぜサーバーが必要？**
→ Claude APIキーをブラウザに置くと誰でも見えてしまう。サーバーに置いて中継することで安全に管理する。

---

## Step 2: ディレクトリ構成

```
docanalyzer/
├── client/                          # フロントエンド
│   ├── vite.config.ts               # Viteの設定（プロキシ等）
│   └── src/
│       ├── main.tsx                  # エントリーポイント（ここからApp.tsxを読み込む）
│       ├── App.tsx                   # ルート。SidebarとMainPanelを配置
│       ├── index.css                 # Tailwindの読み込み + グローバルスタイル
│       ├── types/index.ts           # 型定義（Document, ChatMessage等）
│       ├── hooks/
│       │   ├── useDocumentStore.ts  # 文書データの状態管理
│       │   └── useChatStore.ts      # チャット履歴の状態管理
│       ├── lib/
│       │   ├── api.ts              # サーバーとの通信（fetch）
│       │   ├── pdfParser.ts        # PDFからテキスト抽出
│       │   ├── chunker.ts          # テキストをチャンクに分割（RAG用）
│       │   ├── cosine.ts           # コサイン類似度の計算
│       │   └── vectorStore.ts      # ベクトル検索（RAG用）
│       └── components/
│           ├── layout/
│           │   ├── Sidebar.tsx      # 左サイドバー
│           │   ├── Header.tsx       # 上部ヘッダー + タブ切替
│           │   └── MainPanel.tsx    # メインコンテンツ
│           ├── upload/
│           │   └── FileUploader.tsx # ファイルアップロード
│           ├── summary/
│           │   └── SummaryView.tsx  # AI要約表示
│           ├── chat/
│           │   ├── ChatPanel.tsx    # チャット画面全体
│           │   ├── ChatMessage.tsx  # 1つのメッセージ
│           │   └── ChatInput.tsx    # 入力欄
│           ├── keywords/
│           │   └── KeywordCloud.tsx # キーワードバブル
│           ├── sentiment/
│           │   └── SentimentChart.tsx # 感情分析グラフ
│           └── ui/                  # 共通部品
│               ├── Button.tsx
│               ├── Card.tsx
│               ├── Spinner.tsx
│               ├── Tabs.tsx
│               └── Badge.tsx
├── server/                          # バックエンド
│   ├── .env                         # APIキー（git管理しない）
│   └── src/
│       ├── index.ts                 # Expressサーバー起動
│       ├── routes/
│       │   ├── analyze.ts          # 要約・キーワード・感情分析API
│       │   ├── chat.ts             # Q&AチャットAPI
│       │   └── embed.ts            # テキストのベクトル化API
│       └── lib/
│           ├── claude.ts           # Claude API呼び出し
│           ├── prompts.ts          # AIへの指示文（プロンプト）
│           └── tfidf.ts            # TF-IDFベクトル化
```

---

## Step 3: 各ファイルが何をしているか

### データの流れで理解する

#### 1. PDFアップロード時の流れ

```
ユーザーがPDFをドロップ
  ↓
FileUploader.tsx    … ファイルを受け取る
  ↓
pdfParser.ts        … PDFからテキストを抽出
  ↓
chunker.ts          … テキストを500文字ずつのチャンクに分割
  ↓
api.ts → server/embed.ts → tfidf.ts
                    … 各チャンクを数値ベクトルに変換（検索用）
  ↓
useDocumentStore.ts … 文書データとして保存
vectorStore.ts      … ベクトルをメモリに保存（検索用）
```

#### 2. 要約生成の流れ

```
ユーザーが「Generate Summary」をクリック
  ↓
SummaryView.tsx     … api.tsのstreamSummary()を呼ぶ
  ↓
api.ts              … POST /api/analyze/summary にfetch
  ↓
server/analyze.ts   … Claude APIにストリーミングリクエスト
  ↓
server/claude.ts    … @anthropic-ai/sdkでClaude APIを呼ぶ
  ↓
server/prompts.ts   … 「日本語で要約して」という指示文を使う
  ↓
（Claude APIが1文字ずつ返す）
  ↓
server/analyze.ts   … SSEで1文字ずつブラウザに送る
  ↓
api.ts              … SSEを読み取って1文字ずつyield
  ↓
SummaryView.tsx     … 受け取った文字を画面にリアルタイム表示
```

#### 3. Q&Aチャットの流れ（RAG）

```
ユーザーが質問を入力
  ↓
ChatPanel.tsx       … 質問文をベクトル化
  ↓
vectorStore.ts      … コサイン類似度で関連チャンクをtop3検索
  ↓
api.ts              … 関連チャンク + 質問をサーバーに送信
  ↓
server/chat.ts      … プロンプトにコンテキストを埋め込んでClaude APIへ
  ↓
（AIがコンテキストに基づいて回答）
  ↓
ChatPanel.tsx       … ストリーミングで回答を表示 + 参照元を表示
```

---

## Step 4: 重要な仕組みの解説

### SSE（Server-Sent Events）ストリーミング

AIの回答を1文字ずつリアルタイムに表示するための仕組み。

**サーバー側（送る）:**
```typescript
// analyze.ts
res.setHeader('Content-Type', 'text/event-stream');  // SSEですよ宣言

for await (const event of stream) {
  // Claude APIから1チャンクずつ受け取る
  // JSON.stringifyで改行をエスケープして安全に送る
  res.write(`data: ${JSON.stringify(event.delta.text)}\n\n`);
}
res.write('data: [DONE]\n\n');  // 終了合図
```

**クライアント側（受け取る）:**
```typescript
// api.ts
const reader = res.body.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  // "data: \"テキスト\"\n\n" を解析してテキストを取り出す
  const parsed = JSON.parse(data);
  yield parsed;  // 1チャンクずつ呼び出し元に返す
}
```

**ポイント:** SSEでは `\n\n`（空行）が「1メッセージの区切り」。テキスト内の改行と混同しないよう、`JSON.stringify` でエスケープする。

### RAG（検索拡張生成）

AIにドキュメントの内容に基づいて回答させる仕組み。

```
① テキストをチャンク（断片）に分割
   「視覚とは光を...」「聴覚とは音波を...」「嗅覚とは...」

② 各チャンクをベクトル（数値の配列）に変換
   [0.3, 0.1, 0.8, ...]  [0.1, 0.9, 0.2, ...]  ...

③ 質問もベクトルに変換
   「視覚の仕組みは？」→ [0.35, 0.15, 0.75, ...]

④ コサイン類似度で似ているチャンクを探す
   「視覚とは光を...」が最も類似 → これをAIに渡す

⑤ AIに「このコンテキストに基づいて回答して」と指示
```

**TF-IDF（ベクトル化の方法）:**
- TF = 単語の出現頻度。「視覚」がたくさん出るチャンクは「視覚」の値が高い
- IDF = 珍しさ。全チャンクに出る「です」は低い、特定チャンクにだけ出る「ロドプシン」は高い
- TF × IDF = その単語がそのチャンクでどれくらい重要か

### zustand（状態管理）

複数のコンポーネントでデータを共有する仕組み。

```typescript
// useDocumentStore.ts — 定義
export const useDocumentStore = create((set, get) => ({
  documents: [],          // 文書の配列
  activeDocumentId: null, // 今選択中の文書のID

  addDocument: (doc) =>   // 文書を追加する関数
    set((state) => ({
      documents: [...state.documents, doc],
      activeDocumentId: doc.id,
    })),
}));

// 使う側（どのコンポーネントからでもOK）
const doc = useDocumentStore((s) => s.getActiveDocument());
const { addDocument } = useDocumentStore();
```

Sidebarで文書を選択 → MainPanelに即座に反映される、という連携がこれで実現。

### 日本語IME対策

```typescript
// ChatInput.tsx
const composingRef = useRef(false);

// 変換中かどうかを追跡
onCompositionStart={() => { composingRef.current = true; }}
onCompositionEnd={() => { composingRef.current = false; }}

// Enterキー処理
const handleKeyDown = (e) => {
  // composing中（日本語変換中）は送信しない
  if (e.key === 'Enter' && !e.shiftKey && !composingRef.current) {
    e.preventDefault();
    handleSend();
  }
};
```

---

## Step 5: 設定ファイルの解説

### vite.config.ts
```typescript
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // /api で始まるリクエストをサーバー(port 3001)に転送
      '/api': 'http://localhost:3001'
    },
  }
})
```
→ ブラウザ(port 5173)からの `/api/analyze/summary` を、サーバー(port 3001)に自動転送する。

### server/.env
```
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
```
→ APIキーをコードに直書きせず、環境変数ファイルで管理。gitにはアップしない。

### server/src/index.ts
```typescript
app.use(cors({ origin: 'http://localhost:5173' }));  // ブラウザからのアクセス許可
app.use(express.json({ limit: '10mb' }));             // 大きなPDFテキストも受付
app.use('/api/analyze', analyzeRouter);                // /api/analyze/* のルーティング
app.use('/api/chat', chatRouter);                      // /api/chat のルーティング
app.use('/api/embed', embedRouter);                    // /api/embed のルーティング
```

---

## Step 6: 起動方法

```bash
# ターミナル1: サーバー起動
cd server
npm run dev
# → http://localhost:3001 で待ち受け

# ターミナル2: フロントエンド起動
cd client
npm run dev
# → http://localhost:5173 をブラウザで開く
```

---

## Step 7: 開発中にハマったポイントと解決

### 1. SSEで日本語が壊れる
- **原因:** SSEの改行ルール（`\n\n`=メッセージ区切り）とテキスト内の改行が衝突
- **解決:** `JSON.stringify()`でエスケープしてから送信

### 2. PDF解析が文字化け
- **原因:** pdf.jsのテキストアイテムをスペースで結合 → 日本語にスペースが入る
- **解決:** 文字コード判定して日本語の場合はスペースを入れない

### 3. 日本語変換のEnterで送信される
- **原因:** IME変換確定のEnterキーイベントをチャット送信と区別できていない
- **解決:** `compositionstart/end`イベントで変換中フラグを管理

### 4. pdf.jsのworkerが404
- **原因:** CDNのURLにバージョン5.x系のファイルが存在しない
- **解決:** `pdfjs-dist/build/pdf.worker.min.mjs?url` でローカルファイルをViteにバンドルさせる

---

## 技術用語ミニ辞典

| 用語 | 意味 |
|------|------|
| **Vite** | フロントエンドのビルドツール。ファイル変更を即ブラウザに反映 |
| **React** | UIを「コンポーネント」の組み合わせで作るライブラリ |
| **TypeScript** | JavaScriptに型を追加した言語。バグを事前に防ぐ |
| **Tailwind CSS** | クラス名でスタイルを書くCSSフレームワーク |
| **Express** | Node.jsのWebサーバーフレームワーク |
| **SSE** | サーバーからブラウザへ一方向にリアルタイムデータを送る仕組み |
| **RAG** | AIに外部知識を与えて回答精度を上げる手法 |
| **TF-IDF** | 文書内の単語の重要度を数値化する手法 |
| **コサイン類似度** | 2つのベクトルがどれくらい似ているかの指標（0〜1） |
| **zustand** | Reactの状態管理ライブラリ。Reduxより簡単 |
| **プロキシ** | リクエストを別のサーバーに転送する仕組み |
| **CORS** | ブラウザのセキュリティ制限。異なるポート間の通信に許可が必要 |
| **環境変数** | コードに書かずに設定値を外部ファイルで管理する方法 |
