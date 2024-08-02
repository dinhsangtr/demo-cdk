import { Construct } from 'constructs';
import { ENV } from './config/env';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as s3 from 'aws-cdk-lib/aws-s3';

export class DemoCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const domainName = ENV.domainName;
    const subDomain = 'www';

    // Create S3 bucket to host the Vue.js app
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      bucketName: ENV.bucketName,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
      publicReadAccess: true,
      // Allow bucket-level public access
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create a Route 53 hosted zone
    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName,
    });

    // Request an ACM certificate with DNS validation
    const certificate = new acm.Certificate(this, 'MyCertificate', {
      certificateName: ENV.certificateName,
      domainName: domainName,
      // Use the hosted zone for DNS validation
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    // CloudFront distribution
    const distribution = new cloudfront.Distribution(this, 'SiteDistribution', {
      defaultRootObject: 'index.html',
      domainNames: [`${subDomain}.${domainName}`],
      certificate,
      defaultBehavior: {
        origin: new origins.S3Origin(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.ALLOW_ALL,
      },
    });

    // Route 53 alias record for the CloudFront distribution
    new route53.ARecord(this, 'SiteAliasRecord', {
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(distribution)
      ),
      recordName: domainName,
    });

    // Deployment pipeline
    const sourceOutput = new codepipeline.Artifact();
    const buildOutput = new codepipeline.Artifact();

    const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: 'SitePipeline',
      crossAccountKeys: false,
      stages: [
        {
          stageName: 'Source',
          actions: [
            new codepipeline_actions.GitHubSourceAction({
              actionName: 'GitHub',
              owner: ENV.githubUsername,
              repo: ENV.githubRepoFe,
              oauthToken: cdk.SecretValue.secretsManager('Github'),
              output: sourceOutput,
              branch: ENV.githubRepoFeBranch,
            }),
          ],
        },
        {
          stageName: 'Build',
          actions: [
            new codepipeline_actions.CodeBuildAction({
              actionName: 'Build',
              project: new codebuild.PipelineProject(this, 'BuildProject', {
                environment: {
                  buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
                },
                buildSpec: codebuild.BuildSpec.fromObject({
                  version: '0.2',
                  phases: {
                    install: {
                      commands: ['yarn install'],
                    },
                    build: {
                      commands: ['yarn build'],
                    },
                  },
                  artifacts: {
                    // Vue.js build output directory
                    'base-directory': 'dist',
                    files: ['**/*'],
                  },
                }),
              }),
              input: sourceOutput,
              outputs: [buildOutput],
            }),
          ],
        },
        {
          stageName: 'Deploy',
          actions: [
            new codepipeline_actions.S3DeployAction({
              actionName: 'S3Deploy',
              bucket: siteBucket,
              input: buildOutput,
            }),
          ],
        },
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, 'SiteURL', {
      value: distribution.domainName,
    });
  }
}
