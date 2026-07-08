import * as cdk from 'aws-cdk-lib';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import type { Construct } from 'constructs';

export class SecretsStack extends cdk.Stack {
  public readonly whatsAppTokenEncryptionKeySecret: secretsmanager.Secret;
  public readonly aiProviderKeysSecret: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Placeholders only — real values are populated out-of-band (never
    // committed, never CDK-authored). companies.whatsapp_token_encrypted is
    // AES-256 encrypted at rest using this key.
    this.whatsAppTokenEncryptionKeySecret = new secretsmanager.Secret(
      this,
      'WhatsAppTokenEncryptionKey',
      {
        description: 'AES-256 key used to encrypt companies.whatsapp_token_encrypted at rest',
        generateSecretString: {
          passwordLength: 32,
          excludePunctuation: true,
        },
      },
    );

    this.aiProviderKeysSecret = new secretsmanager.Secret(this, 'AiProviderKeys', {
      description: 'API keys for AI providers (CRITICAL and FAST failover pools) and embeddings',
      generateSecretString: {
        generateStringKey: 'placeholder',
        secretStringTemplate: JSON.stringify({
          anthropic: '',
          openai: '',
          mistral: '',
          gemini: '',
          voyage: '',
        }),
        excludePunctuation: true,
      },
    });
  }
}
