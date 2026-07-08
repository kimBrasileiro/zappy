import type * as cdk from 'aws-cdk-lib';
import { NetworkStack } from './network-stack';
import { DatabaseStack } from './database-stack';
import { SecretsStack } from './secrets-stack';
import { EcsStack } from './ecs-stack';
import { HealthCheckStack } from './health-check-stack';
import { AlertingStack } from './alerting-stack';

export interface AppStacksProps {
  app: cdk.App;
  envName: string;
  env: cdk.Environment | undefined;
}

// Composition root: instantiates one independent Stack per concern rather
// than nesting them, so `cdk deploy <StackName>` can target one at a time
// during iteration instead of always deploying the whole graph together.
export function buildAppStacks({ app, envName, env }: AppStacksProps) {
  const prefix = `Zappy-${envName}`;

  const network = new NetworkStack(app, `${prefix}-Network`, { env });

  const secrets = new SecretsStack(app, `${prefix}-Secrets`, { env });

  const database = new DatabaseStack(app, `${prefix}-Database`, {
    env,
    vpc: network.vpc,
    dbSecurityGroup: network.dbSecurityGroup,
    redisSecurityGroup: network.redisSecurityGroup,
  });

  const ecs = new EcsStack(app, `${prefix}-Ecs`, {
    env,
    vpc: network.vpc,
    ecsSecurityGroup: network.ecsSecurityGroup,
    dbSecret: database.cluster.secret!,
  });

  const healthCheck = new HealthCheckStack(app, `${prefix}-HealthCheck`, { env });

  const alerting = new AlertingStack(app, `${prefix}-Alerting`, { env });

  return { network, secrets, database, ecs, healthCheck, alerting };
}
