# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a study/learning repository for exploring Claude and the Anthropic API. It is currently empty and will grow as experiments and samples are added.

## Repository

- GitHub: https://github.com/YumikoOtsuka/StudyClaude (private)
- Branch: master

---

# 業務効率化Webアプリ 要件定義

## 目的

Slack で顧客から届く依頼を起点に、Backlog への課題登録・コーディング準備・Git 操作までの一連の業務フローを効率化する個人用 Web ツール。GitHub Pages で公開する静的 SPA。

## 解決したいペインポイント

1. Slack の依頼文（テキスト＋画像・ファイル添付あり）を読んで Backlog 課題を手動で起票するのが手間
2. Backlog 課題からコーディング作業に入るまでの準備（タスク分解・ブランチ名・コミットメッセージ）が都度ゼロから考えている
3. Backlog の Git リポジトリへのプッシュ前後の定型作業を効率化したい

## 主要機能

### 機能1: Slack 依頼 → Backlog 課題変換

- Slack の投稿内容（テキスト）をペーストし、Gemini AI が課題タイトル・説明文を自動生成
- **Slack 投稿 URL を入力欄に貼り付けると、Backlog 課題の本文末尾に「参照元 Slack」として自動挿入する**
- 画像ファイルをドラッグ＆ドロップまたはファイル選択でアップロードし、Gemini Vision で内容を読み取って課題文に反映
- 生成された課題情報を編集可能なフォームで確認
- Backlog API 経由で課題を登録（以下の項目を設定）
  - 課題タイトル・説明（末尾に Slack URL を含む）
  - 担当者・期限
  - カテゴリ・優先度
  - プロジェクト（複数プロジェクトへの振り分け対応）

**Backlog 課題本文への Slack URL 挿入形式（例）**

```
## 依頼内容
（AI 生成テキスト）

## 参照元 Slack
https://yourworkspace.slack.com/archives/C.../p...
```

### 機能2: Backlog 課題 → コーディング準備

- Backlog 課題番号・内容を入力として Claude AI が以下を生成
  - 実装タスクの分解リスト（設計・コーディング・テスト等）
  - ブランチ名の候補（Backlog 課題番号付き）
  - コミットメッセージテンプレート（Backlog 課題番号と紐づけ）

### 機能3: Git 操作の効率化

- ブランチ名・コミットメッセージをワンクリックでコピー
- Backlog Git のリモートリポジトリへの push コマンドを生成・コピー
- 作業完了時のコメント/ステータス更新用 Backlog API リクエストの自動化（オプション）

### 機能4: 分析ダッシュボード（日次）

**データソース**
- Slack 処理件数: このアプリ経由で処理した件数を localStorage に記録・集計
- Backlog 起票件数・一覧: Backlog API から当日作成分を取得

**表示内容**
- 当日の Slack 依頼処理件数（カード表示）
- 当日の Backlog 起票件数（カード表示）
- 当日起票した課題の一覧テーブル
  - 課題番号・タイトル・プロジェクト・優先度・担当者・作成日時
- **一覧テーブルの CSV 出力ボタン**（クライアントサイドで生成・ダウンロード、サーバー不要）

### 機能5: 分析ダッシュボード（月次）

**データソース**
- Slack 処理件数: localStorage に日別で蓄積したデータを月単位で集計
- Backlog 起票件数: Backlog API から当月作成分を取得

**表示内容**
- 当月の Slack 依頼処理件数（合計）
- 当月の Backlog 起票件数（合計）
- 日別の起票件数グラフ（棒グラフ）
- プロジェクト別・優先度別の内訳（円グラフまたは集計表）
- 当月の課題一覧（日次と同様のテーブル）

**データ保持設計（localStorage）**

アプリが Slack 依頼を処理するたびに以下の形式で記録する：
```json
{
  "history": [
    {
      "date": "2026-02-28",
      "slackProcessed": 3,
      "backlogCreated": ["BLG-123", "BLG-124", "BLG-125"]
    }
  ]
}
```

## 技術制約

- **ホスティング**: GitHub Pages（静的サイト、サーバーサイドなし）
- **フロントエンドのみ**: バニラ HTML / CSS / JavaScript の SPA（フレームワークなし）
- **API キー管理**: 個人利用のため localStorage に保存（設定画面から入力）
- **利用者**: 自分だけ（認証機能は不要）
- **アクセス制限**: なし。GitHub Pages で URL は公開されるが、API キーは各自のブラウザ localStorage にのみ保存されるため、他者がアクセスしてもデータは漏洩しない

## 外部連携

| サービス | 用途 | 認証方式 |
|---|---|---|
| Google Gemini API | テキスト生成・課題生成・タスク分解・画像解析（Vision） | API キー（localStorage） |
| Backlog API | 課題登録・更新・プロジェクト情報取得 | API キー（localStorage） |
| Backlog Git | ブランチ・コミット管理（コマンド生成のみ） | - |

※ AI には Google Gemini API を使用（Google AI Studio で無料の API キーを取得可能）。
※ claude.ai サブスクリプションと Anthropic API は別物のため、Anthropic API は使用しない。

## 画面構成（案）

1. **設定画面** - API キー・Backlog スペース URL・デフォルトプロジェクト等を設定
2. **Slack → Backlog 変換画面** - メイン機能。Slack テキストをペースト → AI 生成 → 課題登録
3. **コーディング準備画面** - Backlog 課題番号入力 → ブランチ名・タスク分解・コミットメッセージ生成
4. **分析画面（日次）** - 当日の Slack 処理件数・Backlog 起票件数・起票一覧
5. **分析画面（月次）** - 月間の件数推移グラフ・プロジェクト別内訳・課題一覧

## 技術選定（確定）

| 項目 | 決定内容 |
|---|---|
| フレームワーク | バニラ JS（フレームワークなし） |
| 画像処理 | Gemini Vision でテキスト化し課題文に反映 |
| グラフライブラリ | Chart.js（CDN 読み込み） |
| リンター | ESLint 9（フラット設定） |
| Husky | 不使用（個人利用のため不要） |

## 開発環境セットアップ

```bash
npm install       # ESLint をインストール
npm run lint      # リントチェック（js/ 以下が対象）
npm run lint:fix  # 自動修正
```

### ESLint 設定（[eslint.config.mjs](eslint.config.mjs)）

- 対象: `js/**/*.js`
- 環境: ブラウザ globals + `Chart`（CDN グローバル）を許可
- `sourceType: 'script'`（ES modules 不使用）

| ルール | レベル | 内容 |
|---|---|---|
| `no-var` | error | `var` 禁止 |
| `eqeqeq` | error | `===` 強制 |
| `no-unused-vars` | warn | 未使用変数を警告 |
| `prefer-const` | warn | 再代入なし変数は `const` |
| `curly` | warn | `if` 本体は `{}` で囲む |
| `no-console` | off | `console.log` 許容 |

---

## Google Gemini API 仕様メモ

### API キー取得
- Google AI Studio（https://aistudio.google.com/）で無料発行
- 無料枠: Gemini 2.0 Flash は 15 RPM / 1,500 RPD（1日1,500リクエスト）

### エンドポイント（テキスト・Vision 共通）

```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=API_KEY
Content-Type: application/json
```

### テキスト生成リクエスト例

```js
const res = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'プロンプトここ' }] }]
    })
  }
);
const data = await res.json();
const text = data.candidates[0].content.parts[0].text;
```

### 画像 + テキスト（Vision）リクエスト例

```js
// File → base64 に変換してから送る
const base64 = await fileToBase64(imageFile);
body: JSON.stringify({
  contents: [{
    parts: [
      { text: '画像の内容を日本語で説明してください' },
      { inline_data: { mime_type: 'image/png', data: base64 } }
    ]
  }]
})
```

### CORS
- CORS 対応済み。ブラウザの `fetch()` から直接呼び出し可能

---

## Backlog API 仕様メモ

### 認証
- クエリパラメータに `?apiKey=YOUR_API_KEY` を付与する（全リクエスト共通）
- OAuth 2.0 はサーバーサイドが必要なため不使用

### CORS
- Backlog API は CORS 対応済み。ブラウザの `fetch()` から直接呼び出し可能

### 主要エンドポイント

| 用途 | メソッド | パス |
|---|---|---|
| プロジェクト一覧 | GET | `/api/v2/projects` |
| プロジェクトメンバー | GET | `/api/v2/projects/{projectKey}/users` |
| 課題一覧（日付フィルタ可） | GET | `/api/v2/issues` |
| 課題登録 | POST | `/api/v2/issues` |

ベース URL: `https://{スペースID}.backlog.com`

### 課題登録 POST の必須パラメータ

| パラメータ | 型 | 説明 |
|---|---|---|
| `projectId` | 数値 | プロジェクト ID |
| `summary` | 文字列 | 課題タイトル |
| `issueTypeId` | 数値 | 課題種別 ID |
| `priorityId` | 数値 | 優先度 ID（2=高 / 3=中 / 4=低） |

主な任意パラメータ: `description`, `dueDate`（yyyy-MM-dd）, `assigneeId`, `categoryId[]`

### 実装上の注意点

- POST の `Content-Type` は **`application/x-www-form-urlencoded`**（JSON 不可）
  → `URLSearchParams` で body を組み立てる
- 配列パラメータは `projectId[]=1&projectId[]=2` のように `[]` サフィックスが必要
- 1 回の取得上限は **100 件**。大量取得時は `offset` でページネーション
- エラー時は `{ errors: [{ message, code }] }` 形式で返る
- APIキーはクエリパラメータに含まれるためブラウザの Network タブで見える（個人利用前提なので許容）

### 課題一覧の日付フィルタ

当日・当月分を取得するには `createdSince` / `createdUntil` を使用：

```js
// 例: 当日作成の課題
params.append('createdSince', '2026-02-28');
params.append('createdUntil', '2026-02-28');
```
