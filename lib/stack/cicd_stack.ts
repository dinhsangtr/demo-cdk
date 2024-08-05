import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';

interface CICDStackProps extends cdk.StackProps {
  env: cdk.Environment;
  stage: string;
  bucket: s3.IBucket;
  githubInfo: {
    gitOwner: string;
    gitRepository: string;
    branch: string;
  };
  connectionARN: string;
  webEnv: {
    baseUrl?: string;
  };
  distributionId: string;
}

/*
 * This will create CodeBuild, CodePipeline stack
 * that use to perform CI/CD.
 */
export class CICDStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CICDStackProps) {
    super(scope, id, props);

    const sourceOutput = new codepipeline.Artifact();
    const buildOutput = new codepipeline.Artifact();

    // We use a GitHub webhook with the PUSH event to trigger CodeBuild
    // whenever new commits are pushed to your TARGET_BRANCH
    // or when a pull request is merged into your branch.
    const gitHubSource = codebuild.Source.gitHub({
      owner: props.githubInfo.gitOwner,
      repo: props.githubInfo.gitRepository,
      webhook: false,
      // webhookFilters: [
      //   codebuild.FilterGroup.inEventOf(codebuild.EventAction.PUSH).andBranchIs(
      //     props.githubInfo.branch
      //   ),
      // ],
    });

    // Create CodeBuild role,
    // which gives Codebuild permissions to access s3, run codebuild:
    const codebuildRole = new iam.Role(this, 'CodeBuildRole', {
      roleName: id + '-codebuild-role',
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal('codebuild.amazonaws.com'),
        new iam.ServicePrincipal('codepipeline.amazonaws.com')
      ),
    });

    codebuildRole.addToPolicy(
      new iam.PolicyStatement({ resources: ['*'], actions: ['s3:*'] })
    );

    // Create build project of CodeBuild:
    const buildProject = new codebuild.Project(this, id + '-codebuild', {
      projectName: id + '-codebuild',
      role: codebuildRole,
      // A boolean value that specifies whether to enable the CodeBuild badge for the project.
      badge: true,
      source: gitHubSource,
      // The path to the build spec file that contains the build instructions for CodeBuild.
      // buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec.yml'),
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          pre_build: {
            commands: [
              'npm install -g yarn',
              'echo Build started on `date`',
              'yarn install',
              'echo "Prepare env"',
              'touch .env',
              'echo "VUE_APP_BASE_URL=$VUE_APP_BASE_URL" >> .env',
              'cat .env',
            ],
          },
          build: {
            commands: ['yarn build'],
          },
          post_build: {
            commands: ['echo Build completed on `date`'],
          },
        },
        env: {
          'exported-variables': ['REPOSITORY_URI'],
        },
        artifacts: {
          files: ['dist/**/*'],
        },
      }),
      // The environment in which the build will run
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
      },
      // An object that contains key-value pairs of environment variables
      // that will be available during the build process.
      environmentVariables: {
        VUE_APP_BASE_URL: {
          value: `${props.webEnv.baseUrl}`,
        },
      },
    });

    // Source action
    const sourceAction =
      new codepipeline_actions.CodeStarConnectionsSourceAction({
        actionName: 'GitHub_Source',
        owner: props.githubInfo.gitOwner,
        repo: props.githubInfo.gitRepository,
        branch: props.githubInfo.branch,
        output: sourceOutput,
        connectionArn: props.connectionARN,
      });

    // manual approval action
    const manualApprovalAction = new codepipeline_actions.ManualApprovalAction({
      actionName: 'BuildApproval',
    });

    // build action
    const buildAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'Build',
      project: buildProject,
      input: sourceOutput,
      outputs: [buildOutput],
    });

    // deploy action
    const deployAction = new codepipeline_actions.S3DeployAction({
      actionName: 'DeployToS3',
      input: buildOutput,
      bucket: props.bucket,
      runOrder: 1,
    });

    // invalidate cache codebuild
    // Ref: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_codepipeline_actions-readme.html#invalidating-the-cloudfront-cache-when-deploying-to-s3
    const invalidateBuildProject = new codebuild.PipelineProject(
      this,
      id + `-invalidate-codebuild`,
      {
        projectName: id + `-invalidate-codebuild`,
        buildSpec: codebuild.BuildSpec.fromObject({
          version: '0.2',
          phases: {
            build: {
              commands: [
                'aws cloudfront create-invalidation --distribution-id ${CLOUDFRONT_ID} --paths "/*"',
              ],
            },
          },
        }),
        environmentVariables: {
          CLOUDFRONT_ID: { value: props.distributionId },
        },
      }
    );

    // Add Cloudfront invalidation permissions to the project
    const distributionArn = `arn:aws:cloudfront::${this.account}:distribution/${props.distributionId}`;
    invalidateBuildProject.addToRolePolicy(
      new iam.PolicyStatement({
        resources: [distributionArn],
        actions: ['cloudfront:CreateInvalidation'],
      })
    );

    // invalidate cache action
    const invalidateAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'InvalidateCache',
      project: invalidateBuildProject,
      input: buildOutput,
      runOrder: 2,
    });

    // pipeline
    new codepipeline.Pipeline(this, id + '-pipeline', {
      pipelineName: id + '-pipeline',
      stages: [
        {
          stageName: 'Source',
          actions: [sourceAction],
        },
        {
          stageName: 'Approve',
          actions: [manualApprovalAction],
        },
        {
          stageName: 'Build',
          actions: [buildAction],
        },
        {
          stageName: 'Deploy',
          actions: [deployAction, invalidateAction],
        },
      ],
    });
  }
}
