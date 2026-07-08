#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { buildAppStacks } from '../lib/app-stack';

const app = new cdk.App();

const envName = app.node.tryGetContext('envName') ?? 'dev';

// Deliberately NOT read from process.env.CDK_DEFAULT_ACCOUNT/REGION — the
// `cdk` CLI auto-populates those from whatever ambient AWS credentials are
// configured on the machine running it, which would silently turn a plain
// `cdk synth` sanity check into a live AWS API call (VPC AZ lookup) against
// someone's real account. Account/region are only resolved from explicit
// CDK context (`cdk deploy -c account=... -c region=...`), so `cdk synth`
// with no context stays environment-agnostic (placeholder AZs, no AWS calls).
const account = app.node.tryGetContext('account');
const region = app.node.tryGetContext('region');
const env: cdk.Environment | undefined = account && region ? { account, region } : undefined;

buildAppStacks({ app, envName, env });
