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
    agentConfigurations,
  } = await getAgentConfigurations(normalizedOptions.agents, workspaceRoot);

  if (disabledAgents.length > 0) {
    const commandNames = disabledAgents.map((a) => {
      if (a === 'cursor') return '"cursor"';
      if (a === 'copilot') return '"code"/"code-insiders"';
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
    normalizedOptions.agents.filter((a) => !disabledAgents.includes(a))
      .length === 0
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

    const outOfDateAgents = fullyConfiguredAgents.filter(
      (a) => agentConfigurations.get(a)?.outdated
    );

    if (outOfDateAgents.length === 0) {
      output.success({
        title: 'All configured AI agents are up to date',
        bodyLines: fullyConfiguredAgents.map((a) => `- ${agentDisplayMap[a]}`),
      });
      process.exit(0);
    } else {
      output.log({
        title: 'The following AI agents are out of date:',
        bodyLines: [
          ...outOfDateAgents.map((a) => {
            const rulesPath = agentConfigurations.get(a).rulesPath;
            const displayPath = rulesPath.startsWith(workspaceRoot)
              ? relative(workspaceRoot, rulesPath)
              : rulesPath;
            return `- ${agentDisplayMap[a]} (${displayPath})`;
          }),
          '',
          'You can update them by running `nx configure-ai-agents`.',
        ],
      });
      process.exit(1);
    }
  }
  // first, prompt for partially configured agents and out of date agents
  const agentsToUpdate: { name: string; message: string }[] = [];
  partiallyConfiguredAgents.forEach((a) => {
    agentsToUpdate.push(getAgentChoiceForPrompt(a, true, false));
  });

  for (const a of fullyConfiguredAgents) {
    if (agentConfigurations.get(a).outdated) {
      agentsToUpdate.push(getAgentChoiceForPrompt(a, false, true));
    }
  }

  let updateResult: Agent[] = [];
  let updateSucceeded = true;
  if (agentsToUpdate.length > 0) {
    if (options.interactive !== false) {
      try {
        updateResult = (
          await prompt<{ agents: Agent[] }>({
            type: 'multiselect',
            name: 'agents',
            message:
              'The following agents are not configured completely or are out of date. Which would you like to update?',
            choices: agentsToUpdate,
            initial: agentsToUpdate.map((_, i) => i),
            required: true,
          } as any)
        ).agents;
      } catch {
        process.exit(1);
      }
    } else {
      // in non-interactive mode, update all
      updateResult = agentsToUpdate.map((a) => a.name as Agent);
    }

    if (updateResult?.length > 0) {
      const updateSpinner = ora(`Updating agent configurations...`).start();
      try {
        await configureAgents(updateResult, workspaceRoot, false);
        updateSpinner.succeed('Agent configurations updated.');
      } catch {
        updateSpinner.fail('Failed to update agent configurations.');
        updateSucceeded = false;
      }
    }
  }

  // then prompt for non-configured agents
  if (nonConfiguredAgents.length === 0) {
    const usingAllAgents =
      normalizedOptions.agents.length === supportedAgents.length;
    const configuredOrUpdatedAgents = [
      ...new Set([
        ...fullyConfiguredAgents,
        ...(updateSucceeded ? updateResult : []),
      ]),
    ];
    output.success({
      title: `No new agents to configure. All ${
        !usingAllAgents ? 'selected' : 'supported'
      } AI agents are already configured:`,
      bodyLines: configuredOrUpdatedAgents.map(
        (agent) => `- ${agentDisplayMap[agent]}`
      ),
    });
    process.exit(0);
  }

  let configurationResult: Agent[];
  if (options.interactive !== false) {
    try {
      configurationResult = (
        await prompt<{ agents: Agent[] }>({
          type: 'multiselect',
          name: 'agents',
          message:
            'Which AI agents would you like to configure? (space to select, enter to confirm)',
          choices: nonConfiguredAgents.map((a) =>
            getAgentChoiceForPrompt(a, false, false)
          ),
          required: true,
        } as any)
      ).agents;
    } catch {
      process.exit(1);
    }
  } else {
    // in non-interactive mode, configure all
    configurationResult = nonConfiguredAgents;
  }
  if (configurationResult?.length === 0) {
    output.log({
      title: 'No agents selected',
    });
    process.exit(0);
  }

  try {
    await configureAgents(configurationResult, workspaceRoot, false);

    const configuredOrUpdatedAgents = [
      ...new Set([
        ...fullyConfiguredAgents,
        ...(updateSucceeded ? updateResult : []),
        ...configurationResult,
      ]),
    ];

    output.success({
      title: 'AI agents set up successfully. Configured agents:',
      bodyLines: configuredOrUpdatedAgents.map(
        (agent) => `- ${agentDisplayMap[agent]}`
      ),
    });

    return;
  } catch (e) {
    output.error({
      title: 'Failed to set up AI agents',
      bodyLines: [e.message],
    });
    process.exit(1);
  }
}

function getAgentChoiceForPrompt(
  agent: Agent,
  partiallyConfigured: boolean,
  outdated: boolean
): { name: string; message: string } {
  let message: string = agentDisplayMap[agent];
  if (partiallyConfigured) {
    message += ' (partially configured)';
  } else if (outdated) {
    message += ' (out of date)';
  }
  return {
    name: agent,
    message,
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
