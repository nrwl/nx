---
title: Metadata-Only Workspaces
description: 'Include non-Nx repositories in Polygraph features without requiring full Nx adoption. Enable zero-friction onboarding for legacy and existing repositories.'
---

## What Are Metadata-Only Workspaces?

Metadata-only workspaces are a way to connect repositories to Nx Cloud that don't have Nx installed or configured. Unlike traditional Nx Cloud workspaces that require Nx to be set up in the repository, metadata-only workspaces can be connected with minimal configuration, allowing you to:

- Include any repository in the Workspace Graph
- Run Conformance rules across all repositories
- Use Custom Workflows for automated compliance checking
- Track dependencies and relationships between repositories

The key benefit is **zero changes required to existing repositories** - you can start using [Polygraph features](/ci/recipes/enterprise/polygraph) immediately without requiring team buy-in or significant migration effort.

## When to Use Metadata-Only Workspaces

Metadata-only workspaces are ideal for:

1. **Legacy Repository Integration**
   - Gain visibility into previously "dark" areas of your codebase
   - Enforce organizational standards across all repositories, not just new ones
2. **Mixed Technology Stacks**
   - Organizations using multiple frameworks and build tools
   - Teams that prefer their existing tooling but want organizational oversight
3. **Gradual Nx Adoption Strategy**
   - Start with organizational visibility before full Nx migration
   - Allow teams to see the benefits of Nx tooling without immediate commitment
4. **Large-Scale Organizations**
   - Companies with hundreds of repositories across different teams
   - Situations where immediate value is needed without waiting for complete migration

## Connecting

{% callout type="note" title="Onboarding Assistance" %}
Reach out to your assigned developer productivity engineer, if you need any assistance in getting set up with polygraph and metadata-only workspaces.
{%/callout %}

{% tabs %}
{% tab label="GitHub Integration" %}

When using the [GitHub VCS Integration](/ci/features/github-integration#access-control), you can easily bulk onboard your existing repositories into polygraph.

1. Start with visiting your organization overview in Nx Cloud
2. Click the **Connect a repository** button
3. Click **Connect repositories to polygraph**
4. Follow the prompts to onboard your repositories
   ![Bulk onboard GitHub repositories](/nx-cloud/enterprise/images/connect-polygraph-to-repos.avif)
5. Click **Connect repositories** to finish

{% /tab %}
{% tab label="Manual" %}

Manual onboarding is done via the normal workspace onboarding process inside Nx Cloud and enable **polygraph features** before finishing the connection.

1. Start with visiting your organization overview in Nx Cloud
2. Click the **Connect a repository** button
3. Follow the prompts to connect your workspace
4. Enable polygraph features as metadata-only workspace
5. Click **Connect workspace** to finish

Repeat process for each workspace you want to connect as metadata-only workspace.

{% /tab %}
{% /tabs %}
