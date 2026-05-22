# ハブワークスペース 引継ぎ書

最終更新: 2026-05-22
ブランチ: `claude/upbeat-dirac-evyrP`

## 1. 完成状況サマリ

| カテゴリ | 状態 |
|---|---|
| バックエンド（Express + PG + JWT） | ✅ 全エンドポイント実装済み |
| フロントエンド（React + Vite + Tailwind） | ✅ 全ページ実装済み |
| カンバンボード（@dnd-kit） | ✅ 完成 |
| ガントチャート（インタラクティブ3モード） | ✅ 完成 |
| ToolContextPacket送信・受信 | ✅ 完成 |
| Claude API連携（DNA要約） | ✅ サーバーサイドのみ |
| ヘルスポーリング（60秒間隔） | ✅ 完成（サーバー側＋クライアント側両方） |
| 単体テスト | ❌ 未着手（指示書では実装要） |
| `npm install` 後の動作確認 | ❌ 未実施 |

進捗の体感: **コードベース 100%・実機検証 0%**。次回はまず `npm install` → DB起動 → migrate → seed → 起動チェックの順で動作確認すること。

---

## 2. ディレクトリ構造

```
/home/user/shin2/
├── package.json              # ルート workspace 設定
├── .env.example
├── .gitignore
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── types/index.ts                      # 全ドメイン型
│       ├── constants/index.ts                  # 定数（JWT期限・status・error code 等）
│       ├── errors.ts                           # AppError, NotImplementedError
│       ├── db/
│       │   ├── pool.ts                         # PG プール + query<T>() ジェネリック
│       │   ├── migrations/001_initial.sql      # 全テーブル定義
│       │   ├── migrate.ts                      # マイグレーション実行
│       │   └── seed.ts                         # 初期データ投入
│       ├── middleware/
│       │   ├── auth.ts                         # JWT 検証
│       │   └── errorHandler.ts                 # 統一エラーレスポンス
│       ├── services/
│       │   ├── claude.ts                       # Claude API（DNA要約・タスクサマリ）
│       │   ├── healthPoller.ts                 # ツール死活監視（60秒）
│       │   ├── toolContextPacket.ts            # ToolContextPacket 組立・送信・受信
│       │   └── activityLogger.ts               # 監査証跡
│       ├── routes/
│       │   ├── auth.ts                         # /api/auth/{login,logout,refresh}
│       │   ├── clients.ts                      # /api/clients + /dna
│       │   ├── projects.ts                     # /api/projects + /kanban + /gantt + /dependencies
│       │   ├── tasks.ts                        # /api/tasks + /execute + /packets
│       │   ├── toolRegistry.ts                 # /api/tools + /health
│       │   ├── dashboard.ts                    # /api/dashboard
│       │   ├── templates.ts                    # /api/templates
│       │   ├── activityLog.ts                  # /api/activity
│       │   ├── invoices.ts                     # /api/invoices
│       │   └── workflows.ts                    # /api/workflows（自動実行は NotImplementedError）
│       └── index.ts                            # Express エントリポイント
└── client/
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts                          # /api → :3001 プロキシ
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    └── src/
        ├── types/index.ts                      # 全型
        ├── constants/index.ts                  # 日本語ラベル定数
        ├── lib/api.ts                          # axios + 自動 refresh + 全 APIクライアント
        ├── stores/
        │   ├── authStore.ts                    # アクセストークン（メモリ）
        │   ├── themeStore.ts                   # dark/light（localStorage persist）
        │   ├── toolStatusStore.ts              # ツール稼働状態
        │   └── toastStore.ts                   # 通知
        ├── hooks/
        │   ├── useAuth.ts                      # login/logout 副作用
        │   └── useHealthPolling.ts             # 60秒ごとに /api/tools 取得
        ├── components/
        │   ├── ui/                             # Button, Input, Select, Spinner,
        │   │                                   #   Modal, Badge, Toast, Card, Textarea
        │   ├── layout/                         # Sidebar, Header, Layout, ToolStatusBanner
        │   ├── kanban/                         # KanbanBoard/Column/Card（@dnd-kit）
        │   └── gantt/GanttChart.tsx            # ★ 最も複雑なコンポーネント
        ├── pages/                              # Login, Dashboard,
        │   │                                   #   clients/{List,Detail,Form},
        │   │                                   #   projects/{List,Detail},
        │   │                                   #   tasks/Detail, tools/Registry,
        │   │                                   #   templates/List, activity/Log,
        │   │                                   #   billing/List
        ├── App.tsx                             # Router + Protected route + silent refresh
        ├── main.tsx
        └── index.css
```

---

## 3. 起動手順（次回の最優先タスク）

```bash
# 1. 依存インストール（ルートで一括）
cd /home/user/shin2
npm install

# 2. PostgreSQL を立ち上げる（Docker 推奨）
docker run -d --name hub-db -p 5432:5432 \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=hub_workspace \
  postgres:16

# 3. .env を作成
cp .env.example .env
# JWT_ACCESS_SECRET / JWT_REFRESH_SECRET を安全な値に置換
# ANTHROPIC_API_KEY を本物の値に置換（DNA 要約機能を使う場合）

# 4. マイグレーション + シード
npm run migrate
npm run seed

# 5. 開発サーバー起動（サーバー + クライアント並列）
npm run dev
# → サーバー: http://localhost:3001
# → クライアント: http://localhost:5173

# 6. ログイン
# email:    admin@hub.local
# password: HubAdmin2024!
```

---

## 4. 既知の未確認事項・改善ポイント

次回の動作確認時に高確率で引っかかりそうなポイント:

### 4.1 TypeScript ビルドエラーの可能性
- `tsx watch` で型エラーがあっても起動はするが、`npm run build` で検出される可能性あり
- 特に `pool.query<T>()` のジェネリック型推論まわり
- 一部の Express ルートで `req.params['id']` を `string | undefined` として扱っているため `!` 演算子を使用しているが、より厳密にしたい場合は明示的なバリデーションを足す

### 4.2 silent refresh が user 情報を返さない
- 現状 `POST /api/auth/refresh` は `accessToken` のみ返す
- ページリロード時に user 情報が空のままになる
- 対応案: `/api/auth/me` エンドポイントを追加して App.tsx で user 情報を取得する

### 4.3 ToolContextPacket の direction フィールド
- サーバーは `'sent' | 'received'` を使う（DB 制約）
- クライアント型では一部 `'outbound' | 'inbound'` という古い表記が残っている可能性あり → `client/src/types/index.ts` を確認
- 統一する場合は `'sent' | 'received'` 側に揃える

### 4.4 ガントチャート
- ★ **最も複雑**。3 つのドラッグ操作（中央移動 / 右端リサイズ / 依存矢印）を実装済み
- DOM `elementFromPoint` で依存先タスクを判定しているため、`data-gantt-task-id` 属性が必要なすべての行に正しく付いていることを目視確認すること
- ズームレベルの永続化はしていない

### 4.5 リスト仮想化
- 指示書では「100クライアント・500プロジェクトで軽快」とあるが、現状は React Query で全件取得＋普通の map レンダ
- 必要に応じて `@tanstack/react-virtual` を ClientList のリストビュー・ActivityLog に導入する余地あり（package.json には既に追加済み）

### 4.6 テスト
- 指示書「単体テストのみ実装」だが、現状 **全く未実装**
- 次回優先度: 中（ロジック検証）
- 推奨対象:
  - `toolContextPacket.ts` の buildAndSendPacket
  - `auth.ts` の login / refresh
  - errorHandler の各ブランチ
  - ガントチャートの日付計算ロジック

### 4.7 Claude API の実コスト確認
- `summarizeDnaForTask` は claude-sonnet-4-6
- `generateTaskSummary` は claude-haiku-4-5-20251001
- 入力に DNA 全件＋タスク本文を渡しているため、DNA 項目が増えると入力トークンが膨らむ
- 必要であれば DNA 項目を上位 N 件に絞る、または事前要約をキャッシュする実装に変更

### 4.8 Vercel デプロイ
- 指示書はデプロイ先 Vercel と明記しているが、現状は単純な Node サーバー
- Vercel デプロイには:
  - サーバーを Vercel Functions / Express adapter にラップ
  - PostgreSQL は外部（Neon / Supabase 等）
  - クライアントは Vercel 静的サイトとしてビルド
- まだ何も対応していないので別タスクとして取り組む

---

## 5. ヒアリング確定事項の対応状況

| 仕様 | 対応 |
|---|---|
| REST API 経由ツール通信 | ✅ `/api/task` POST で実装 |
| ヘルスチェック 60秒ポーリング | ✅ サーバー側 `healthPoller` + クライアント側 `useHealthPolling` |
| ステータス3値 online/offline/degraded | ✅ DB 制約 + UI Badge |
| オフライン検知でバナー表示 | ✅ `ToolStatusBanner` |
| 請求書ハブ内入力 | ✅ `BillingList` + `invoices` テーブル |
| 外部会計ツール連携を見越したスキーマ | ✅ `invoices.external_invoice_id` カラム |
| DNA フルテキスト送信禁止・要約のみ | ✅ Claude API で要約 |
| Claude API キーをクライアント露出禁止 | ✅ サーバー env のみ |
| アクセストークン15分・リフレッシュ7日 | ✅ 定数で管理 |
| メモリにアクセストークン保持 | ✅ Zustand store（永続化なし） |
| リフレッシュトークン HttpOnly Cookie | ✅ `Secure` `SameSite=Strict` |
| localStorage トークン禁止 | ✅ 保存していない |
| ガント3操作（中央/右端/依存矢印） | ✅ 実装済み |
| ドラッグ中ツールチップ | ✅ 実装済み |
| 多言語不要・日本語のみ | ✅ |
| モバイル非対応 | ✅ デスクトップ前提 |
| エラーレスポンス統一フォーマット | ✅ `{ success: false, error: { code, message, details? } }` |
| ToolContextPacket schema_version | ✅ `'1.0.0'` 定数 |
| TODO(hub) コメント形式 | ✅ workflows の自動実行ステップで使用 |
| seed: tpl_lp_standard 等3テンプレ | ✅ |

---

## 6. 次回の進行プラン

### A. 動作確認フェーズ（最優先・1〜2時間）
1. `npm install` 実行 → エラー解消
2. PostgreSQL 起動・migrate・seed
3. `npm run dev` 起動 → サーバー・クライアントの両プロセスが立つことを確認
4. ブラウザで `/login` → seed ユーザーでログイン
5. 各ページ（Dashboard / Clients / Projects / Tools / Templates / Billing / Activity）を巡回し、エラー発生箇所を洗い出す
6. TypeScript ビルドエラーがあれば修正（`npm run build` 実行）

### B. バグ修正フェーズ
- ガントチャート、カンバン、ToolContextPacket送信あたりが要注意
- ToolContextPacket の送信はモックツール（ローカルで `nc -l 3002` などで応答するダミー）で確認すると安全

### C. 機能補完フェーズ
- `/api/auth/me` 追加 → ページリロード後のユーザー名表示
- リスト仮想化（クライアント100件・プロジェクト500件想定の負荷テスト含む）
- 単体テストの追加（vitest + supertest 推奨）

### D. 余裕があれば
- Vercel デプロイ設定
- E2E（Playwright）
- ガントチャート: 月単位以外の表示モード（週・日）

---

## 7. バックグラウンドエージェント再試行の留意点

前回エージェントは途中で停滞した。再試行する場合の改善案:
- **タスクを小さく分割**して投げる（例: 「サーバーのルートだけ」「カンバンだけ」など）。1 エージェントに 30+ ファイルを書かせると停滞しやすい
- **既存コードの差分追記**を依頼する場合は対象ファイルパスを明示
- 並列エージェントは 2 つまで。3 つ目以降は通信競合で待ち時間が伸びがち
- 進捗確認は **生成済みファイル数の `ls` で**（エージェントへ SendMessage は今回利用不可だった）

---

## 8. 主要コマンドリファレンス

```bash
# 全体
npm run dev                # サーバー＋クライアント並列起動
npm run build              # 両方ビルド

# サーバー単体
npm run dev:server         # tsx watch
npm run migrate            # マイグレーション実行
npm run seed               # 初期データ投入

# クライアント単体
npm run dev:client         # Vite dev server
```

---

## 9. 次の人 / 自分への一言

最も削減できそうな工数は **「型不整合の事後修正」**。`npm run build` を最初に通せば残りはほぼ動くはず。
ガントチャートは複雑なので、もしバグるなら最初に `data-gantt-task-id` の有無と `dayWidth` のズームスケールから疑う。
ToolContextPacket は Claude API キーが本物でないと DNA 要約で 500 を返すので、テスト時は `summarizeDnaForTask` を一時的にスタブ化すると良い。
