import * as cdk from 'aws-cdk-lib';
import * as sns from 'aws-cdk-lib/aws-sns';
import type { Construct } from 'constructs';

export class AlertingStack extends cdk.Stack {
  public readonly alertsTopic: sns.Topic;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // No subscription wired yet — email/Slack subscription is an operational
    // task for a later phase. CloudWatch Alarms added later (ECS CPU, ALB
    // 5xx, RDS connections) publish here immediately once wired.
    this.alertsTopic = new sns.Topic(this, 'AlertsTopic', {
      displayName: 'Chat IA Alerts',
    });

    new cdk.CfnOutput(this, 'AlertsTopicArn', { value: this.alertsTopic.topicArn });
  }
}
