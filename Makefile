template-front-main:
	CDK_DEPLOY_ACCOUNT=xxxxxxxxxxxx CDK_DEPLOY_REGION=ap-northeast-1 \
	cdk synth PipelineFrontendStack > template/main/template_frontend_main.yml

template-back-main:
	CDK_DEPLOY_ACCOUNT=xxxxxxxxxxxx CDK_DEPLOY_REGION=ap-northeast-1 \
	cdk synth PipelineBackendStack > template/main/template_backend_main.yml

template-iac-main:
	CDK_DEPLOY_ACCOUNT=xxxxxxxxxxxx CDK_DEPLOY_REGION=ap-northeast-1 \
	cdk synth PipelineIaCStack > template/main/template_iac_main.yml

template-front-stg:
	CDK_DEPLOY_ACCOUNT=xxxxxxxxxxxx CDK_DEPLOY_REGION=ap-northeast-1 \
	cdk synth PipelineFrontendStack > template/staging/template_frontend_stg.yml

template-back-stg:
	CDK_DEPLOY_ACCOUNT=xxxxxxxxxxxx CDK_DEPLOY_REGION=ap-northeast-1 \
	cdk synth PipelineBackendStack > template/staging/template_backend_stg.yml

template-iac-stg:
	CDK_DEPLOY_ACCOUNT=xxxxxxxxxxxx CDK_DEPLOY_REGION=ap-northeast-1 \
	cdk synth PipelineIaCStack > template/staging/template_iac_stg.yml

template-front-prd:
	CDK_DEPLOY_ACCOUNT=xxxxxxxxxxxx CDK_DEPLOY_REGION=ap-northeast-1 \
	cdk synth PipelineFrontendStack > template/production/template_frontend_prd.yml

template-back-prd:
	CDK_DEPLOY_ACCOUNT=xxxxxxxxxxxx CDK_DEPLOY_REGION=ap-northeast-1 \
	cdk synth PipelineBackendStack > template/production/template_backend_prd.yml

template-iac-prd:
	CDK_DEPLOY_ACCOUNT=xxxxxxxxxxxx CDK_DEPLOY_REGION=ap-northeast-1 \
	cdk synth PipelineIaCStack > template/production/template_iac_prd.yml

.PHONY: template-front-main template-back-main template-iac-main template-front-stg template-back-stg template-iac-stg template-front-prd template-back-prd template-iac-prd