import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import type { Construct } from 'constructs';

export class HealthCheckStack extends cdk.Stack {
  public readonly healthCheckFunction: lambda.Function;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Stub only — phase 1 wires the EventBridge -> Lambda shape so a later
    // phase can drop in the real logic (GET /api/cron/health-check, compare
    // against health_status, create health_incidents rows, email via Resend
    // only on status transitions) without restructuring this stack.
    this.healthCheckFunction = new lambda.Function(this, 'HealthCheckFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(
        `exports.handler = async () => { console.log('health-check stub'); return { statusCode: 200 }; };`,
      ),
      timeout: cdk.Duration.seconds(30),
    });

    // Placeholder cadence — real cadence is a later decision once the actual
    // health-check logic (and its cost/rate-limit implications) is built.
    new events.Rule(this, 'HealthCheckSchedule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      targets: [new targets.LambdaFunction(this.healthCheckFunction)],
    });
  }
}
