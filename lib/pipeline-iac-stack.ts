import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

import * as codecommit from "aws-cdk-lib/aws-codecommit";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as codedeploy from "aws-cdk-lib/aws-codedeploy";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions";
import * as chatbot from "aws-cdk-lib/aws-chatbot";
import * as iam from "aws-cdk-lib/aws-iam";
import * as kms from "aws-cdk-lib/aws-kms";
import * as s3 from "aws-cdk-lib/aws-s3";
import { IRole } from "aws-cdk-lib/aws-iam";
import { IBucket } from "aws-cdk-lib/aws-s3";

import { DeployBranchName, deployBranchNames } from "../config/types";

export class PipelineIaCStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    //パラメータの設定
    const slackWorkspaceId = new cdk.CfnParameter(this, "slackWorkspaceId", {
      type: "String",
      description: "The ID of the Slack workspace authorized with AWS Chatbot.",
    });

    const slackChannelId = new cdk.CfnParameter(this, "slackChannelId", {
      type: "String",
      description: "The ID of the Slack channel.",
    });

    const sourceAccountId = new cdk.CfnParameter(this, "sourceAccountID", {
      type: "String",
      description: "The ID of the source account.",
    });

    const branchType = new cdk.CfnParameter(this, "Branch", {
      type: "String",
      description: "branch which pipeline is going to use.",
      allowedValues: deployBranchNames,
      default: "main",
    });

    const codeCommitRoleIaCArn = new cdk.CfnParameter(
      this,
      "codeCommitRoleFrontendArn",
      {
        type: "String",
        description: "Arn of IAMRole prepared at codeCommit Account",
      }
    );

    //ここからリソースの作成を開始
    const { accountId, region } = new cdk.ScopedAws(this);
    const branch = branchType.valueAsString as DeployBranchName;
    const sourceAccountID = sourceAccountId.valueAsString;
    const resourceName = "codepipeline-iac"; // codecommit側のリポジトリ名に変更する

    // slackチャンネルを作成
    const slackChannel = new chatbot.SlackChannelConfiguration(
      this,
      "slackChannel",
      {
        slackChannelConfigurationName: "slackChannel",
        slackWorkspaceId: slackWorkspaceId.valueAsString,
        slackChannelId: slackChannelId.valueAsString,
      }
    );

    // codecommit環境にあるソースコードのリポジトリを取得
    const repository = codecommit.Repository.fromRepositoryArn(
      this,
      `sourceRepository-${resourceName}`,
      `arn:aws:codecommit:ap-northeast-1:${sourceAccountID}:${resourceName}`
    );

    // Codecommit環境へのアクセスのためのロールを取得
    const codeCommitRole = iam.Role.fromRoleArn(
      this,
      `codeCommitRole-${resourceName}`,
      codeCommitRoleIaCArn.valueAsString,
      {
        mutable: false,
      }
    );

    // CodeBuildのサービスロールを作成
    const codeBuildRole = this.createCodeBuildRole(
      accountId,
      region,
      resourceName
    );

    // CodePipelineのサービスロールを作成
    const codePipelineRole = this.createCodePipelineRole(
      accountId,
      region,
      resourceName,
      codeCommitRoleIaCArn.valueAsString
    );

    // Artifact格納用バケットを暗号化するための鍵を作成
    const encryptionKey = this.createArtifactKey(
      accountId,
      region,
      resourceName,
      sourceAccountID,
      codeBuildRole,
      codePipelineRole
    );

    // Artifact格納用バケットを作成
    const artifactBucket = this.createArtifactBucket(
      accountId,
      resourceName,
      branch,
      sourceAccountID,
      encryptionKey
    );

    // CodePipelineで使用するArtifactを定義
    const sourceOutput = new codepipeline.Artifact();
    const buildOutput = new codepipeline.Artifact();

    // codePipelineを作成
    const pipeline = this.createCodepipelies(
      resourceName,
      slackChannel,
      codePipelineRole,
      artifactBucket
    );

    // source stageでのアクション作成とPipelineへの追加
    const sourceAction = new codepipeline_actions.CodeCommitSourceAction({
      actionName: `sourceAction-${resourceName}`,
      repository: repository,
      output: sourceOutput,
      branch: branch,
      role: codeCommitRole,
      trigger: codepipeline_actions.CodeCommitTrigger.POLL, // CodePipeline will poll the repository to detect changes.
    });
    pipeline.addStage({
      stageName: "Source",
      actions: [sourceAction],
    });

    // build stageでのアクション作成とPipelineへの追加
    const pipeLineproject = this.createCodebuildProject(
      resourceName,
      codeBuildRole,
      encryptionKey
    );
    const buildAction = new codepipeline_actions.CodeBuildAction({
      actionName: `buildAction-${resourceName}`,
      project: pipeLineproject,
      input: sourceOutput,
      outputs: [buildOutput],
    });
    pipeline.addStage({
      stageName: "Build",
      actions: [buildAction],
    });

    // TODO: デプロイステージはコンピューティングリソース作成後追加する
  }

  /**
   * CodePipelineを作成
   */
  private createCodepipelies(
    resourceName: string,
    slackChannel: chatbot.SlackChannelConfiguration,
    role: IRole,
    bucket: IBucket
  ): codepipeline.Pipeline {
    const pipeline = new codepipeline.Pipeline(
      this,
      `codePipeline-${resourceName}`,
      {
        pipelineName: `codePipeline-${resourceName}`,
        crossAccountKeys: true,
        artifactBucket: bucket,
        role: role,
      }
    );
    // slackへの通知を追加
    // https://docs.aws.amazon.com/cdk/api/v1/python/aws_cdk.aws_codepipeline/PipelineNotificationEvents.html
    pipeline.notifyOn("Notify", slackChannel, {
      events: [
        codepipeline.PipelineNotificationEvents.ACTION_EXECUTION_FAILED,
        codepipeline.PipelineNotificationEvents.ACTION_EXECUTION_SUCCEEDED,
        codepipeline.PipelineNotificationEvents.MANUAL_APPROVAL_FAILED,
        codepipeline.PipelineNotificationEvents.MANUAL_APPROVAL_SUCCEEDED,
        codepipeline.PipelineNotificationEvents.PIPELINE_EXECUTION_FAILED,
        codepipeline.PipelineNotificationEvents.PIPELINE_EXECUTION_SUCCEEDED,
        codepipeline.PipelineNotificationEvents.STAGE_EXECUTION_SUCCEEDED,
        codepipeline.PipelineNotificationEvents.STAGE_EXECUTION_SUCCEEDED,
      ],
    });
    return pipeline;
  }

  /**
   * codeBuildプロジェクトを作成
   */
  private createCodebuildProject(
    resourceName: string,
    role: iam.Role,
    key: kms.Key
  ): codebuild.PipelineProject {
    const pipelineProject = new codebuild.PipelineProject(
      this,
      `codeBuild-${resourceName}`,
      {
        role: role,
        encryptionKey: key,
        environment: {
          buildImage: codebuild.LinuxBuildImage.fromCodeBuildImageId(
            "aws/codebuild/amazonlinux2-x86_64-standard:4.0"
          ),
          privileged: true,
        },
      }
    );
    return pipelineProject;
  }

  /**
   * CodeCommitがあるAWSアカウントにスイッチロールし連携するためのロール
   */
  private createCodePipelineRole(
    accountId: string,
    region: string,
    resourceName: string,
    codeCommitAccountRole: string
  ): iam.Role {
    const assumeCodeCommitAccountRole = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["sts:AssumeRole"],
      resources: [codeCommitAccountRole],
    });
    const s3Statement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "s3:PutObject",
        "s3:GetObject",
        "s3:GetObjectVersion",
        "s3:GetBucketVersioning",
      ],
      resources: [
        `arn:aws:s3:::buildartifactbucket-${resourceName}`,
        `arn:aws:s3:::buildartifactbucket-${resourceName}/*`,
      ],
    });
    const codeBuildStatement = new iam.PolicyStatement({
      actions: ["codebuild:BatchGetBuilds", "codebuild:StartBuild"],
      resources: [`arn:aws:codebuild:${region}:${accountId}:project/*`],
    });

    const policy = new iam.ManagedPolicy(
      this,
      `codePipelineServicePolicy-${resourceName}`,
      {
        statements: [
          assumeCodeCommitAccountRole,
          s3Statement,
          codeBuildStatement,
        ],
      }
    );

    const role = new iam.Role(this, `codePipelineServiceRole-${resourceName}`, {
      roleName: `codePipelineServiceRole-${resourceName}`,
      managedPolicies: [policy],
      assumedBy: new iam.ServicePrincipal("codepipeline.amazonaws.com"),
    });
    return role;
  }

  /**
   * CodeBuildのサービスロールを作成
   */
  private createCodeBuildRole(
    accountId: string,
    region: string,
    resourceName: string
  ): iam.Role {
    const logsStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
      ],
      resources: [
        `arn:aws:logs:${region}:${accountId}:log-group:/aws/codebuild/*`,
      ],
    });
    const s3Statement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "s3:PutObject",
        "s3:GetObject",
        "s3:GetObjectVersion",
        "s3:GetBucketVersioning",
      ],
      resources: [
        `arn:aws:s3:::buildartifactbucket-${resourceName}`,
        `arn:aws:s3:::buildartifactbucket-${resourceName}/*`,
      ],
    });

    const policy = new iam.ManagedPolicy(
      this,
      `codeCommitContributorPolicy-${resourceName}`,
      {
        statements: [logsStatement, s3Statement],
      }
    );

    const role = new iam.Role(this, `codeBuildServiceRole-${resourceName}`, {
      roleName: `codeBuildServiceRole-${resourceName}`,
      managedPolicies: [policy],
      assumedBy: new iam.ServicePrincipal("codebuild.amazonaws.com"),
    });
    return role;
  }

  /**
   * アーティファクト暗号化用のKMS Keyを作成
   */
  private createArtifactKey(
    accountId: string,
    region: string,
    resourceName: string,
    sourceAccountID: string,
    codePipelineServiceRole: iam.Role,
    codeBuildServiceRole: iam.Role
  ): kms.Key {
    const cryptKey = new kms.Key(this, `artifactKey-${resourceName}`);

    // 環境アカウントからの操作権限
    cryptKey.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ArnPrincipal(`arn:aws:iam::${accountId}:root`)],
        actions: ["kms:*"],
        resources: [`arn:aws:kms:${region}:${accountId}:key/*`],
      })
    );

    // CI/CDの各ステージ + 親アカウントからの操作権限
    cryptKey.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [
          new iam.ArnPrincipal(codePipelineServiceRole.roleArn),
          new iam.ArnPrincipal(codeBuildServiceRole.roleArn),
          new iam.ArnPrincipal(`arn:aws:iam::${sourceAccountID}:root`),
        ],
        actions: [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey",
        ],
        resources: [`arn:aws:kms:${region}:${accountId}:key/*`],
      })
    );

    cryptKey.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [
          new iam.ArnPrincipal(codePipelineServiceRole.roleArn),
          new iam.ArnPrincipal(codeBuildServiceRole.roleArn),
          new iam.ArnPrincipal(`arn:aws:iam::${sourceAccountID}:root`),
        ],
        actions: ["kms:CreateGrant", "kms:ListGrants", "kms:RevokeGrant"],
        resources: [`arn:aws:kms:${region}:${accountId}:key/*`],
        conditions: {
          Bool: {
            "kms:GrantIsForAWSResource": true,
          },
        },
      })
    );
    return cryptKey;
  }

  /**
   * アーティファクト用のS3バケットを作成
   */
  private createArtifactBucket(
    accountId: string,
    resourceName: string,
    branch: DeployBranchName,
    sourceAccountID: string,
    cryptKey: kms.Key
  ): s3.Bucket {
    const artifactBucket = new s3.Bucket(
      this,
      `buildArtifactBucket-${resourceName}`,
      {
        bucketName: `${resourceName}s3bucket`, // ユニークな命名のため必要なパラメータを全て含めている
        encryption: s3.BucketEncryption.KMS,
        encryptionKey: cryptKey,
      }
    );

    // KMSで暗号化されていない場合はアップロート不可
    artifactBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.DENY,
        principals: [new iam.AnyPrincipal()],
        actions: ["s3:PutObject"],
        resources: [`arn:aws:s3:::${artifactBucket.bucketName}/*`],
        conditions: {
          StringNotEquals: {
            "s3:x-amz-server-side-encryption": "aws:kms",
          },
        },
      })
    );
    // HTTPS通信でない場合は操作不可
    artifactBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "DenyInsecureConnections",
        effect: iam.Effect.DENY,
        principals: [new iam.AnyPrincipal()],
        actions: ["s3:*"],
        resources: [`arn:aws:s3:::${artifactBucket.bucketName}/*`],
        conditions: {
          Bool: {
            "aws:SecureTransport": false,
          },
        },
      })
    );

    // クロスアカウントからの操作を許可
    artifactBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [
          new iam.ArnPrincipal(`arn:aws:iam::${sourceAccountID}:root`),
        ],
        actions: ["s3:Get*", "s3:Put*", "s3:ListBucket"],
        resources: [
          `arn:aws:s3:::${artifactBucket.bucketName}/*`,
          `arn:aws:s3:::${artifactBucket.bucketName}`,
        ],
      })
    );
    // CI/CD環境からの操作を許可
    artifactBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ArnPrincipal(`arn:aws:iam::${accountId}:root`)],
        actions: ["s3:Get*", "s3:Put*", "s3:ListBucket"],
        resources: [
          `arn:aws:s3:::${artifactBucket.bucketName}/*`,
          `arn:aws:s3:::${artifactBucket.bucketName}`,
        ],
      })
    );
    return artifactBucket;
  }
}
