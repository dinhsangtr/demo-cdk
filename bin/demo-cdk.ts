#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DemoCdkStack } from '../lib/demo-cdk-stack';
import { ENV } from '../lib/config/env';

const app = new cdk.App();
new DemoCdkStack(app, 'DemoCdkStack');
app.synth();
