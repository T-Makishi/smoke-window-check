# 初心者向け 作業開始ガイド

## 最初に理解すること

- GitHubはアプリの設計図と変更履歴を保管する場所です。
- GitHubへ置いただけでは、問診や写真は会社へ届きません。
- 顧客が使う公開画面と、会社が受け取る仕組みを分けて作ります。

## 全体の順序

### 1. 専用GitHubリポジトリを作る

推奨値は次のとおりです。

- 所有者: `T-Makishi`
- Repository name: `smoke-window-check`
- Description: `排煙窓セルフ診断・概算見積Webアプリ`
- 公開設定: 開発中はPrivateを推奨。ただしGitHub Pagesの利用条件は契約プランにより異なります。
- README、`.gitignore`、License: GitHub画面では追加しない。ローカル側に準備済みです。

作成後に表示されるリポジトリURLを控えます。例: `https://github.com/T-Makishi/smoke-window-check.git`

### 2. ローカルのアプリを接続する

ターミナルで次を実行します。Codexが代行する場合は、リポジトリ作成後にURLを確認してから実行します。

```bash
cd "/Users/mt/Documents/アプリ開発/smoke-window-check"
git remote add origin https://github.com/T-Makishi/smoke-window-check.git
git push -u origin main
```

### 3. GitHub上で自動テストを確認する

1. リポジトリ画面の `Actions` を開きます。
2. `Test` を開きます。
3. 緑色のチェックになれば成功です。
4. 赤色の場合は本番公開せず、原因を修正します。

### 4. テスト公開する

1. GitHubのリポジトリで `Settings` を開きます。
2. 左側の `Pages` を開きます。
3. `Build and deployment` のSourceで `Deploy from a branch` を選びます。
4. Branchを `main`、Folderを `/(root)` にして保存します。
5. 表示されたURLをスマートフォンで開きます。

この段階では画面確認用です。問診と写真の正式受付には使用しません。

### 5. Supabaseプロジェクトを作る

1. Supabaseへログインします。
2. 新しいプロジェクトを作ります。
3. データベースの地域と強いパスワードを設定します。
4. プロジェクトURLと公開用キーを控えます。
5. 秘密鍵はブラウザ、GitHub、メールへ貼り付けません。

プロジェクト作成後、Codexがテーブル、非公開Storage、受付APIのコードを追加します。

### 6. メール送信サービスを接続する

送信元ドメインを認証できるトランザクションメールサービスを使用します。試験中の通知先は `makishi0520@gmail.com` です。送信元アドレスと会社ドメインは、実際の会社情報を確認してから設定します。

### 7. 本番前テストを行う

- 自分のスマートフォンから架空の顧客情報で送信する。
- メールが届くことを確認する。
- Supabaseで同じ受付番号を確認する。
- 写真・動画が第三者に公開されていないことを確認する。
- 通信を切った場合に入力内容が残ることを確認する。
- 試験データを削除する。

## 毎回の更新方法

1. Codexがコードを変更します。
2. ローカルで自動テストと画面確認を行います。
3. GitHubへ変更を送ります。
4. GitHub Actionsの緑色チェックを確認します。
5. テスト環境で確認した後、本番へ反映します。

不具合があるコードを直接本番へ送らないため、通常は作業用ブランチとPull Requestを使用します。

