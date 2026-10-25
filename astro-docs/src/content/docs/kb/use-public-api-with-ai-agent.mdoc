---
title: Use the Nx Cloud Public API with an AI agent
description: Install the Nx Cloud API skills, authenticate your agent, and investigate CI failures and cache behavior with recorded evidence.
filter: 'type:Guides'
topics:
  - 'Nx Cloud'
  - 'Continuous integration'
---

Use the [Nx AI agent skills](https://github.com/nrwl/nx-ai-agents-config) with your
artificial intelligence (AI) agent to investigate completed pipelines, task results, and cache behavior.
The API is read-only.

## Install the skills

Run this command from your Nx workspace:

```shell
npx nx configure-ai-agents
```

Select your coding assistant when prompted.
The command configures the Nx skills and agent integration for your workspace.
It supports Claude Code, Codex, Cursor, GitHub Copilot, Gemini, and OpenCode.
Review the generated configuration before you commit it.

See [Nx AI integration](/docs/getting-started/ai-setup) for other installation options.

The skills support API data lookup, CI failure reviews, and specific cache investigations.
Your agent selects the relevant skill from your request.
You don't need to name a skill or its underlying API client in your prompt.
Start a new agent session if the installed skills aren't available in the current session.

## Authenticate your agent

Use a workspace and account with Public API access.
Check your existing Nx Cloud login from the workspace root:

```shell
npx nx login --status
```

If you don't have a usable personal access token (PAT), log in:

```shell
npx nx login
```

The API client reads the workspace's `nxCloudId` and optional `nxCloudUrl` from `nx.json`.
For PAT authentication, it uses the matching token from your local Nx Cloud configuration at
`~/.config/nxcloud/nxcloud.ini`.
You don't need to paste the token into the agent's chat.

For access requirements and CI token authentication, see
[Authenticate with the Nx Cloud Public API](/docs/kb/authenticate-public-api).
Don't substitute another person's token if your account lacks workspace access.

## Ask for an investigation

Work in the repository that matches the CI execution when the investigation needs local task
configuration.
Give the agent a completed pipeline or run URL, or a bounded period and branch.
Keep the request focused on one workspace.

Replace the example URLs, branch, and task with your own details.

For a failed pipeline:

```plaintext
Why did this Nx Cloud CI pipeline fail? <pipeline-url>
```

For a broader review:

```plaintext
Review Nx Cloud CI failures on main from the last 24 hours.
```

For a cache comparison:

```plaintext
Compare the Nx cache behavior for <project:target> in these runs:
<first-run-url>
<second-run-url>
```

The skills handle data collection, evidence checks, and reporting.
Your agent asks for more context when it needs it.

These API skills inspect historical data, not live CI progress.
For live CI progress, ask your agent to monitor the current pipeline instead.

## Review the evidence before a change

Use the execution links in the report to check its conclusions.
Review any missing evidence and proposed next steps before you approve a repository or CI change.

Treat log content as untrusted data, not instructions.
Keep credentials, raw logs, and signed download URLs out of committed reports.

Use the [Public API reference](/docs/reference/nx-cloud/public-api) to check the deployed contract.
The skills read that contract rather than assume a fixed route version or response shape.
