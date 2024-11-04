# Nx Cloud AI

Nx Cloud AI offers a suite of features designed to **enhance your development workflow with AI-driven capabilities**. These tools assist in troubleshooting, optimizing resource allocation, and improving your overall development process.

- **[Explain with AI](/ci/features/explain-with-ai)** - This feature uses AI to provide detailed explanations about failed tasks.
- **Automatic Resource Allocation** (Coming Soon) - This upcoming feature will use custom AI/ML models to dynamically allocate resources based on your project’s specific needs. It optimizes performance by efficiently assigning Nx Agents to achieve target durations for main and PR branches.

## Enable Nx Cloud AI Features

To enable AI features for your organization, go to your organization's settings on [Nx Cloud](https://cloud.nx.app/orgs?utm_source=nx.dev&utm_campaign=ai) and select the organization where you want to enable AI.

In the **settings** menu, find the "AI Features" section and toggle it to "On".

![enable ai features](/nx-cloud/features/ai-features.png)

Ensure that you **accept the AI terms** to start using the AI features.

{% callout type="info" title="AI Features Availability" %}

AI features are available only for the [Nx Cloud Pro plan](/pricing). If you are on the Hobby plan, you can start a free trial to test AI features in your workspace.

{% /callout %}

### Enable AI Features for Enterprise On-Prem Installations

To enable AI features for enterprise on-prem installations, add the following configuration to your `helm-values.yaml` file:

```yaml
nxApi
  deployment:
    env:
      - name: NX_CLOUD_AI_ENABLED
        value: 'true'

frontend
  deployment:
    env:
      - name: OPENAI_SECRET_KEY
        valueFrom:
          secretKeyRef:
            name: open-ai-secrets
            key: OPENAI_SECRET_KEY
      - name: NX_CLOUD_AI_ENABLED
        value: 'true'
```

Ensure your OpenAI secret key is correctly configured to provide the necessary credits for `gpt-3.5-turbo` and `gpt-4`.

### Regional Availability

This feature is not available for the EU cluster in public cloud installations due to regional restrictions. However, on-prem customers in the EU can still use this feature by providing their own OpenAI secret key and enabling the required environment variables.
