# Cloudflare運用設計

## 目的

GitHubをソースコード管理に残し、Cloudflare Pages、Pages Functions、D1、Accessを使って、次の運用を実現する。

- お客様はログインせずに問診を利用できる。
- 問診内容、写真、動画はお客様の端末内だけで扱い、サーバーへ保存しない。
- 業者設定はアプリ独自のメール確認リンク、端末認証、登録パスコードで保護する。
- 業者ごとに7日、14日、30日の試験利用期限を設定できる。
- 期限終了または利用停止時は、問診画面を表示せず案内画面を表示する。
- 会社情報、料金、ロゴをD1へ保存し、お客様用URLを短くする。

## 利用者と権限

| 利用者 | 認証 | 操作 |
| --- | --- | --- |
| お客様 | 不要 | 問診、端末保存、メール・LINE共有、印刷 |
| 業者担当者 | メール確認コード + 登録パスコード | 自社の会社情報、料金、ロゴ、送信先の変更 |
| サービス運営者 | メール確認コード + 登録パスコード + 運営者メール一致 | 業者登録、7/14/30日の期限発行・延長、停止・再開 |

## URL

- お客様用: `https://smoke-window-check.pages.dev/?t=<tenant_id>`
- 業者ログイン開始: `/api/vendor/login?tenant=<tenant_id>`
- 運営者画面: `/service.html`
- 業者API: `/api/vendor/*`
- 運営者API: `/api/service/*`
- 公開設定API: `/api/public/config?tenant=<tenant_id>`

`tenant_id` は推測しにくいランダム値を使用する。会社情報と料金はURLへ埋め込まない。

## D1データ

`tenants` テーブルだけを使用し、問診データは保存しない。

- `id`: 公開用の業者ID
- `company_name`: 管理一覧用の会社名
- `vendor_email`: 業者ログインに使用するメールアドレス
- `settings_json`: 公開可能な会社情報・料金・表示設定
- `trial_days`: 7、14、30のいずれか
- `starts_at`: 利用開始日時（UTC）
- `expires_at`: 利用終了日時（UTC）
- `status`: `active` または `suspended`
- `created_at`, `updated_at`: 監査用日時（UTC）

試験期間は開始日を1日目として数え、最終日の23:59:59（日本時間）まで利用可能とする。

## 認証と認可

Cloudflare Accessを `/api/service/*` に適用し、セッション時間を24時間にする。`/api/vendor/*` はAccessの対象外とし、Pages Function側でメール確認済み端末と登録パスコードを確認する。

- 業者API: 1回限りのメールリンクで発行した端末セッションと `vendor_email` が一致すること。
- 運営者API: 認証メールが `SERVICE_ADMIN_EMAIL` と一致すること。
- 公開設定API: 認証不要。ただし `status` と `expires_at` を必ず確認する。

業者APIはD1の確認済み端末セッション、会社識別番号、登録メールを照合し、他業者の設定を閲覧・変更できないようにする。運営管理APIはAccess通過後もD1の運営者メールと照合する。

登録パスコードはD1へ平文保存しない。Cloudflareの暗号化シークレット `PASSCODE_PEPPER` とレコードごとのランダムソルトを使ったHMAC-SHA-256だけを保存する。オンライン認証は5回失敗で15分間ロックし、認証後のアプリセッションは24時間とする。初回登録と再設定は、アプリが登録メールへ送る15分・1回限りの確認リンクを開いた直後に限定する。確認済み端末は30日間保持する。

## 障害時の動作

- 公開設定APIまたはD1へ接続できない場合は問診を表示しない。
- 期限切れ、停止、登録なしを別の案内文で表示する。
- Pages Functionsの無料枠超過時はFail closedを使用する。
- 旧GitHub PagesはCloudflare版の検証完了まで残し、完了後に停止して期限確認の迂回を防ぐ。

## 移行互換性

GitHub Pages上の既存URL（`recipient` / `cfg`）は移行確認中のみ従来どおり動作させる。Cloudflare運用では `t` がある短いURLを正式な案内URLとする。
