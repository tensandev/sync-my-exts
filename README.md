# Sync My Extensions

VS Code拡張機能一覧をGitHubアカウントを通じて簡単に共有するVS Code拡張機能です。

## 機能

- **拡張機能一覧の同期**: 現在インストールされている拡張機能の一覧をGitHubリポジトリに保存
- **拡張機能のインポート**: GitHubから保存された拡張機能一覧を読み込み、選択してインストール
- **ユーザー設定の同期**: VS Codeのユーザー設定（settings.json）をGitHubに同期・インポート
- **リモート設定の同期**: リモート接続時の設定も自動で同期・インポート
- **GitHub OAuth認証**: ブラウザから直接GitHubにログイン（トークン手動入力不要）
- **簡単設定**: サイドバーからClient ID、Client Secret、リポジトリ名を設定

## セットアップ

### GitHub OAuth Appの作成

1. GitHubにログインし、[Settings > Developer settings > OAuth Apps](https://github.com/settings/developers)にアクセス
2. "New OAuth App"をクリック
3. 以下の情報を入力：
   - **Application name**: `Sync My Extensions`
   - **Homepage URL**: `https://github.com`
   - **Authorization callback URL**: `http://localhost:3000/callback`
4. OAuth Appを作成し、Client IDとClient Secretを取得

### 初回セットアップ

1. サイドバーの「Sync My Exts」アイコンをクリック
2. 「GitHubにログイン」をクリック
3. 初回実行時に以下を順次入力：
   - **Client ID**: GitHub OAuth AppのClient ID
   - **Client Secret**: GitHub OAuth AppのClient Secret
   - **リポジトリ名**: 同期先のGitHubリポジトリ名（例: `username/repo-name`）
4. ブラウザでGitHub認証ページが開くので、認証を完了
5. 表示された認証コードをVS Codeに入力

## 使用方法

### 拡張機能一覧の同期・インポート

1. サイドバーから「拡張機能一覧をGitHubに同期」をクリック
2. 現在インストールされている拡張機能の一覧がGitHubリポジトリに保存されます

### 拡張機能一覧のインポート

1. サイドバーから「GitHubから拡張機能一覧をインポート」をクリック
2. 保存された拡張機能一覧が表示されます
3. インストールしたい拡張機能を選択してインストール

### ユーザー設定の同期・インポート

1. サイドバーから「ユーザー設定をGitHubに同期」をクリック
2. 現在のVS Code設定がGitHubリポジトリに保存されます

### ユーザー設定のインポート

1. サイドバーから「GitHubからユーザー設定をインポート」をクリック
2. 保存された設定が現在のVS Codeに適用されます

### 設定の変更

- **リポジトリ名の変更**: サイドバーから「リポジトリ名を変更」をクリック
- **OAuth設定の変更**: VS Codeの設定から`syncMyExts.clientId`と`syncMyExts.clientSecret`を編集

## セキュリティ

- OAuth認証を使用し、トークンはVS Codeのsecretsストレージに安全に保存されます
- Client Secretは設定ファイルに保存されますが、VS Codeの設定は暗号化されません
- リポジトリへのアクセス権限は最小限（repo または public_repo）に設定することを推奨します

## 開発

### 必要な依存関係のインストール

```bash
npm install
```

### 拡張機能のビルド

```bash
npm run compile
```

### 開発時の監視

```bash
npm run watch
```

## ライセンス

MIT License
