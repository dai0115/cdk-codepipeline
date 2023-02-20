## codePipelineStack の作成

### CDK のインストール

```bash
$ npm install -g aws-cdk
```

```bash
$ cdk --version
```

### テンプレートの作成

cdk で直接デプロイできない場合、Makefile から cfn のテンプレートを作成することが可能

### デプロイ or アップデート

- 新たにリソースを構築する場合、`frontend`用の Pipeline からデプロイする。
- ただ、どちらかしか利用しない場合などは適宜コードを修正して利用する。

### デプロイ時のパラメータ

- slackWorkspaceId

  - slack ワークスペースの Id を入力

- slackChannelId

  - slack チャンネルの Id を入力

- sourceAccountId

  - codeCommit 環境の AWS アカウント を入力

- branchType

  - デプロイする環境に応じてブランチタイプを入力

  1. 開発環境 → `main`
  2. 検証環境 → `staging`
  3. 本番環境 → `production`

- codeCommitRolexxxArn
  - codecommit アカウントで作成した該当の Role の Arn を入力
