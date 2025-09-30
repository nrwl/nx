import { prompt } from 'enquirer';
import { output } from '../../utils/output';
import { ensurePackageHasProvenance } from '../../utils/provenance';
import * as chalk from 'chalk';

import {
  Agent,
  agentDisplayMap,
  supportedAgents,
  configureAgents,
  getAgentConfigurations,
  AgentConfiguration,
} from '../../ai/utils';
import { installPackageToTmp } from '../../devkit-internals';
import { workspaceRoot } from '../../utils/workspace-root';
import { ConfigureAiAgentsOptions } from './command-object';
import ora = require('ora');
import { relative } from 'path';

export async function configureAiAgentsHandler(
  args: ConfigureAiAgentsOptions,
  inner = false
): Promise<void> {
  // Use environment variable to force local execution
  if (process.env.NX_AI_FILES_USE_LOCAL === 'true' || inner) {
    return await configureAiAgentsHandlerImpl(args);
  }

  let cleanup: () => void | undefined;
  try {
    await ensurePackageHasProvenance('nx', 'latest');
    const packageInstallResults = installPackageToTmp('nx', 'latest');
    cleanup = packageInstallResults.cleanup;

    let modulePath = require.resolve(
      'nx/src/command-line/configure-ai-agents/configure-ai-agents.js',
      { paths: [packageInstallResults.tempDir] }
    );

    const module = await import(modulePath);
    const configureAiAgentsResult = await module.configureAiAgentsHandler(
      args,
      true
    );
    cleanup();
    return configureAiAgentsResult;
  } catch (error) {
    if (cleanup) {
      cleanup();
    }
    // Fall back to local implementation
    return configureAiAgentsHandlerImpl(args);
  }
}

export async function configureAiAgentsHandlerImpl(
  options: ConfigureAiAgentsOptions
): Promise<void> {
  const normalizedOptions = normalizeOptions(options);

  const {
    nonConfiguredAgents,
    partiallyConfiguredAgents,
    fullyConfiguredAgents,
    disabledAgents,
  } = await getAgentConfigurations(normalizedOptions.agents, workspaceRoot);

  if (disabledAgents.length > 0) {
    const commandNames = disabledAgents.map((a) => {
      if (a.name === 'cursor') return '"cursor"';
      if (a.name === 'copilot') return '"code"/"code-insiders"';
      return a;
    });

    const title =
      commandNames.length === 1
        ? `${commandNames[0]} command not available.`
        : `CLI commands ${commandNames
            .map((c) => `${c}`)
            .join('/')} not available.`;

    output.log({
      title,
      bodyLines: [
        chalk.dim(
          'To manually configure the Nx MCP in your editor, install Nx Console (https://nx.dev/getting-started/editor-setup)'
        ),
      ],
    });
  }

  if (
    normalizedOptions.agents.filter(
      (agentName) => !disabledAgents.find((a) => a.name === agentName)
    ).length === 0
  ) {
    output.error({
      title: 'Please select at least one AI agent to configure.',
    });
    process.exit(1);
  }

  if (options.check) {
    if (fullyConfiguredAgents.length === 0) {
      output.log({
        title: 'No AI agents are configured',
        bodyLines: [
          'You can configure AI agents by running `nx configure-ai-agents`.',
        ],
      });
      process.exit(0);
    }

    const outOfDateAgents = fullyConfiguredAgents.filter((a) => a?.outdated);

    if (outOfDateAgents.length === 0) {
      output.success({
        title: 'All configured AI agents are up to date',
        bodyLines: fullyConfiguredAgents.map((a) => `- ${a.displayName}`),
      });
      process.exit(0);
    } else {
      output.log({
        title: 'The following AI agents are out of date:',
        bodyLines: [
          ...outOfDateAgents.map((a) => {
            const rulesPath = a.rulesPath;
            const displayPath = rulesPath.startsWith(workspaceRoot)
              ? relative(workspaceRoot, rulesPath)
              : rulesPath;
            return `- ${a.displayName} (${displayPath})`;
          }),
          '',
          'You can update them by running `nx configure-ai-agents`.',
        ],
      });
      process.exit(1);
    }
  }
  const allAgentChoices: AgentPromptChoice[] = [];
  const preselectedIndices: number[] = [];
  let currentIndex = 0;

  nonConfiguredAgents.forEach((a) => {
    allAgentChoices.push(getAgentChoiceForPrompt(a, false, false));
    currentIndex++;
  });

  for (const a of fullyConfiguredAgents) {
    if (a.outdated) {
      allAgentChoices.push(getAgentChoiceForPrompt(a, false, true));
      preselectedIndices.push(currentIndex);
      currentIndex++;
    }
  }

  partiallyConfiguredAgents.forEach((a) => {
    allAgentChoices.push(getAgentChoiceForPrompt(a, true, false));
    preselectedIndices.push(currentIndex);
    currentIndex++;
  });

  if (allAgentChoices.length === 0) {
    const usingAllAgents =
      normalizedOptions.agents.length === supportedAgents.length;
    output.success({
      title: `No new agents to configure. All ${
        !usingAllAgents ? 'selected' : 'supported'
      } AI agents are already configured:`,
      bodyLines: fullyConfiguredAgents.map((agent) => `- ${agent.displayName}`),
    });
    process.exit(0);
  }

  let selectedAgents: Agent[];
  if (options.interactive !== false) {
    try {
      selectedAgents = (
        await prompt<{ agents: Agent[] }>({
          type: 'multiselect',
          name: 'agents',
          message:
            'Which AI agents would you like to configure? (space to select, enter to confirm)',
          choices: allAgentChoices,
          initial: preselectedIndices,
          required: true,
          footer: function () {
            const focused = this.focused as AgentPromptChoice;
            if (focused.partial) {
              return chalk.dim(focused.partialReason);
            }
          },
        } as any)
      ).agents;
    } catch {
      process.exit(1);
    }
  } else {
    // in non-interactive mode, configure all
    selectedAgents = allAgentChoices.map((a) => a.name);
  }

  if (selectedAgents?.length === 0) {
    output.log({
      title: 'No agents selected',
    });
    process.exit(0);
  }

  // Configure/update all selected agents
  const configSpinner = ora(`Configuring agent(s)...`).start();
  try {
    await configureAgents(selectedAgents, workspaceRoot, false);

    const configuredOrUpdatedAgents = [
      ...new Set([
        ...fullyConfiguredAgents.map((a) => a.name),
        ...selectedAgents,
      ]),
    ];

    configSpinner.succeed('AI agents set up successfully.');

    output.log({
      title: 'Configured Agents',
      bodyLines: configuredOrUpdatedAgents.map(
        (agent) => `- ${agentDisplayMap[agent]}`
      ),
    });

    return;
  } catch (e) {
    configSpinner.fail('Failed to set up AI agents');
    output.error({
      title: 'Error details:',
      bodyLines: [e.message],
    });
    process.exit(1);
  }
}

type AgentPromptChoice = {
  name: Agent;
  message: string;
  partial: boolean;
  outdated: boolean;
  partialReason?: string;
  agentConfiguration: AgentConfiguration;
};

function getAgentChoiceForPrompt(
  agent: AgentConfiguration,
  partiallyConfigured: boolean,
  outdated: boolean
): AgentPromptChoice {
  let message: string = agent.displayName;
  if (partiallyConfigured) {
    message += ` (${agent.rules ? 'MCP missing' : 'rules missing'})`;
  } else if (outdated) {
    message += ' (out of date)';
  }
  const displayPath = agent.rulesPath.startsWith(workspaceRoot)
    ? relative(workspaceRoot, agent.rulesPath)
    : agent.rulesPath;
  const partialReason = partiallyConfigured
    ? agent.rules
      ? `  Partially configured: MCP missing ${
          agent.mcpPath ? `at ${agent.mcpPath}` : 'via Nx Console'
        }`
      : `  Partially configured: rules file missing at ${displayPath}`
    : undefined;
  return {
    name: agent.name,
    message,
    outdated,
    partial: partiallyConfigured,
    partialReason,
    agentConfiguration: agent,
  };
}

type NormalizedAiAgentSetupOptions = Omit<
  ConfigureAiAgentsOptions,
  'agents'
> & {
  agents: Agent[];
};
function normalizeOptions(
  options: ConfigureAiAgentsOptions
): NormalizedAiAgentSetupOptions {
  const agents = (options.agents ?? supportedAgents).filter((a) =>
    supportedAgents.includes(a as Agent)
  ) as Agent[];
  return {
    ...options,
    agents,
    check: options.check ?? false,
  };
}
