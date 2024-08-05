import { getEnv } from '../common/utils/env';

export const project = (getEnv('PROJECT_NAME') || 'demo-cdk').toLowerCase();
export const stage = (getEnv('STAGE') || 'dev').toLowerCase();
export const prefix = `${project}-${stage}`;

export const ENV = {
  prefix: prefix,
  // AWS
  awsAccountId: getEnv('AWS_ACCOUNT_ID') || '',
  region: getEnv('REGION') || 'ap-southeast-1',
  projectName: project,
  stage: stage,
  // Github
  githubOwner: getEnv('GITHUB_OWNER') || '',
  githubRepoFe: getEnv('GITHUB_REPO_FE') || '',
  githubRepoFeBranch: getEnv('GITHUB_REPO_FE_BRANCH') || 'main',
  // AWS Secret
  // githubTokenSecret: getEnv('AWS_GITHUB_TOKEN_SECRET') || '',
  // Code Pipeline - Connection
  connectionArn: getEnv('CONNECTION_ARN') || '',
  // Route53
  hostedZoneName: getEnv('HOSTED_ZONE_NAME') || '',
  domainName: getEnv('DOMAIN_NAME') || '',
  // ACM
  // acmDomainName: getEnv('ACM_DOMAIN_NAME') || '',
  certificateARN: getEnv('CERTIFICATE_ARN') || '',
};
