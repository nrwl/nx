---
title: 'configure-ai-agents - CLI command'
description: 'Configure and update AI agent configurations for your workspace.'
---

# configure-ai-agents

Configure and update AI agent configurations for your workspace.

## Usage

```shell
nx configure-ai-agents
```

Install `nx` globally to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpm nx`.

## Options

| Option          | Type                                             | Description                                                                                                                                                                            |
| --------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--agents`      | `claude`, `codex`, `copilot`, `cursor`, `gemini` | List of AI agents to set up.                                                                                                                                                           |
| `--check`       | `outdated`, `all`                                | Check agent configurations. Use --check or --check=outdated to check only configured agents, or --check=all to include unconfigured/partial configurations. Does not make any changes. |
| `--help`        | boolean                                          | Show help.                                                                                                                                                                             |
| `--interactive` | boolean                                          | When false disables interactive input prompts for options. (Default: `true`)                                                                                                           |
| `--verbose`     | boolean                                          | Prints additional information about the commands (e.g., stack traces).                                                                                                                 |
| `--version`     | boolean                                          | Show version number.                                                                                                                                                                   |
