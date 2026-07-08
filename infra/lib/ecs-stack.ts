import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import type { Construct } from 'constructs';

export interface EcsStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  ecsSecurityGroup: ec2.SecurityGroup;
  dbSecret: secretsmanager.ISecret;
}

const WEB_APP_DIR = path.join(__dirname, '..', '..', 'apps', 'web');

export class EcsStack extends cdk.Stack {
  public readonly cluster: ecs.Cluster;
  public readonly migrationTaskDefinition: ecs.FargateTaskDefinition;

  constructor(scope: Construct, id: string, props: EcsStackProps) {
    super(scope, id, props);

    this.cluster = new ecs.Cluster(this, 'Cluster', { vpc: props.vpc });

    const databaseUrlSecret = {
      DATABASE_URL: ecs.Secret.fromSecretsManager(props.dbSecret, 'connectionString'),
    };

    // Web service — phase 1: serves the placeholder Next.js app from
    // apps/web/app/page.tsx. Real dashboard/inbox/KB UI land in a later phase.
    const webService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'WebService', {
      cluster: this.cluster,
      cpu: 512,
      memoryLimitMiB: 1024,
      desiredCount: 1,
      minHealthyPercent: 100,
      taskImageOptions: {
        image: ecs.ContainerImage.fromAsset(WEB_APP_DIR, { target: 'runner' }),
        containerPort: 3000,
        secrets: databaseUrlSecret,
      },
      circuitBreaker: { rollback: true },
      // No ACM cert / registered domain yet in phase 1 — HTTP-only listener.
      // TODO(phase-2-infra): add HTTPS listener once a domain + ACM cert exist.
      protocol: cdk.aws_elasticloadbalancingv2.ApplicationProtocol.HTTP,
    });
    webService.targetGroup.configureHealthCheck({ path: '/api/health' });
    webService.service.connections.securityGroups.forEach((sg) =>
      sg.addIngressRule(props.ecsSecurityGroup, ec2.Port.tcp(3000), 'Internal ECS-to-ECS'),
    );

    webService.service.autoScaleTaskCount({ minCapacity: 1, maxCapacity: 2 }).scaleOnCpuUtilization(
      'CpuScaling',
      { targetUtilizationPercent: 70 },
    );

    // Migration task — NOT a Service, NOT attached to the ALB. Invoked as a
    // one-off ECS RunTask from the deploy pipeline (a later phase), which
    // must wait for it to reach STOPPED with exitCode 0 before updating the
    // web service's task definition/desired count. Runs against the "build"
    // Docker stage (full workspace + node_modules + prisma CLI), not the
    // pruned "runner" stage used by the web service above.
    this.migrationTaskDefinition = new ecs.FargateTaskDefinition(this, 'MigrationTaskDefinition', {
      cpu: 256,
      memoryLimitMiB: 512,
    });
    this.migrationTaskDefinition.addContainer('migrate', {
      image: ecs.ContainerImage.fromAsset(WEB_APP_DIR, { target: 'build' }),
      command: ['pnpm', '--filter', '@chat-ia/db', 'db:migrate:prod'],
      secrets: databaseUrlSecret,
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'chat-ia-migrate' }),
    });

    new cdk.CfnOutput(this, 'MigrationTaskDefinitionArn', {
      value: this.migrationTaskDefinition.taskDefinitionArn,
    });
    new cdk.CfnOutput(this, 'EcsClusterName', { value: this.cluster.clusterName });
    new cdk.CfnOutput(this, 'PrivateSubnetIds', {
      value: props.vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }).subnetIds.join(
        ',',
      ),
    });
    new cdk.CfnOutput(this, 'EcsSecurityGroupId', {
      value: props.ecsSecurityGroup.securityGroupId,
    });
  }
}
