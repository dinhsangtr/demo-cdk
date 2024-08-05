import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import { ENV } from './config/env';
import { BucketStack } from './stack/s3_cloudfront_stack';
import { CICDStack } from './stack/cicd_stack';

export class DemoCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const stage = ENV.stage === 'prod' ? 'prod' : 'dev';
    const baseId = ENV.prefix;

    const envUser = {
      account: ENV.awsAccountId,
      region: ENV.region,
    };

    const githubInfo = {
      gitOwner: ENV.githubOwner,
      gitRepository: ENV.githubRepoFe,
      branch: ENV.githubRepoFeBranch,
    };

    const bucketStack = new BucketStack(scope, baseId + '-web', {
      env: envUser,
      stage: stage,
      route53: {
        domainName: ENV.domainName,
        hostedZoneName: ENV.hostedZoneName,
      },
      acm: {
        domainName: ENV.domainName,
        certificateARN: ENV.certificateARN,
      },
    });

    new CICDStack(scope, baseId + '-cicd', {
      env: envUser,
      stage: stage,
      bucket: bucketStack.s3Bucket,
      githubInfo: githubInfo,
      connectionARN: ENV.connectionArn,
      webEnv: {
        baseUrl: '',
      },
      distributionId: bucketStack.distribution.distributionId,
    });
  }
}
