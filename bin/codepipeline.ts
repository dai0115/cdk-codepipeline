#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { DefaultStackSynthesizer } from "aws-cdk-lib";
import { PipelineFrontendStack } from "../lib/pipeline-frontend-stack";
import { PipelineBackendStack } from "../lib/pipeline-backend-stack";
import { PipelineIaCStack } from "../lib/pipeline-iac-stack";

const app = new cdk.App();
new PipelineFrontendStack(app, "PipelineFrontendStack", {
  // テンプレート作成時にbootstrapに関する情報を出力しない
  synthesizer: new DefaultStackSynthesizer({
    generateBootstrapVersionRule: false,
  }),

  // Makefileでテンプレート作成時に環境変数を指定
  env: {
    account: process.env.CDK_DEPLOY_ACCOUNT,
    region: process.env.CDK_DEPLOY_REGION,
  },
});

new PipelineBackendStack(app, "PipelineBackendStack", {
  // テンプレート作成時にbootstrapに関する情報を出力しない
  synthesizer: new DefaultStackSynthesizer({
    generateBootstrapVersionRule: false,
  }),

  // Makefileでテンプレート作成時に環境変数を指定
  env: {
    account: process.env.CDK_DEPLOY_ACCOUNT,
    region: process.env.CDK_DEPLOY_REGION,
  },
});

new PipelineIaCStack(app, "PipelineIaCStack", {
  // テンプレート作成時にbootstrapに関する情報を出力しない
  synthesizer: new DefaultStackSynthesizer({
    generateBootstrapVersionRule: false,
  }),

  // Makefileでテンプレート作成時に環境変数を指定
  env: {
    account: process.env.CDK_DEPLOY_ACCOUNT,
    region: process.env.CDK_DEPLOY_REGION,
  },
});
