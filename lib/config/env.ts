import { getEnv } from '../common/utils/env';

export const project = (getEnv('PROJECT_NAME') || 'demo-cdk').toLowerCase();
export const stage = (getEnv('STAGE') || 'dev').toLowerCase();
export const prefix = `${project}-${stage}`;

export const ENV = {
  // AWS
  awsAccountId: getEnv('AWS_ACCOUNT_ID') || '',
  region: getEnv('REGION') || 'ap-southeast-1',
  projectName: project,
  stage: stage,
  // Domain
  domainName: getEnv('DOMAIN_NAME') || '',
  // Github
  githubUsername: getEnv('GITHUB_USERNAME') || '',
  githubToken: getEnv('GITHUB_TOKEN') || '',
  githubRepoFe: getEnv('GITHUB_REPO_FE') || '',
  githubRepoFeBranch: getEnv('GITHUB_REPO_FE_BRANCH') || 'main',
  //
  distribution: `${prefix}-distribution`,
  vpcName: `${prefix}-vpc`,
  cidrBlock: '10.128.0.0/16',
  // FE
  bucketName: `${prefix}-bucket`,
  certificateName: `${prefix}-certificate`,
};
