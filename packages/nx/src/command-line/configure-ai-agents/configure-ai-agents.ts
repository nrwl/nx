import { prompt } from 'enquirer';
import { output } from '../../utils/output';
import { ensurePackageHasProvenance } from '../../utils/provenance';

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
    agentConfigurations,
  } = await getAgentConfigurations(normalizedOptions.agents, workspaceRoot);

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
      (a) =>
        agentConfigurations.get(a)?.mcpOutdated ||
        agentConfigurations.get(a)?.rulesOutdated
    );

    if (outOfDateAgents.length === 0) {
      output.success({
        title: 'All configured AI agents are up to date',
        bodyLines: fullyConfiguredAgents.map((a) => `- ${a}`),
      });
      process.exit(0);
    } else {
      output.log({
        title: 'The following AI agents are out of date:',
        bodyLines: outOfDateAgents,
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
    if (
      agentConfigurations.get(a).mcpOutdated ||
      agentConfigurations.get(a).rulesOutdated
    ) {
      agentsToUpdate.push(getAgentChoiceForPrompt(a, false, true));
    }
  }

  if (agentsToUpdate.length > 0) {
    let updateResponse: { agents: Agent[] };
    try {
      updateResponse = await prompt<{ agents: Agent[] }>({
        type: 'multiselect',
        name: 'agents',
        message:
          'The following agents are not configured completely or are out of date. Which would you like to update?',
        choices: agentsToUpdate,
        initial: agentsToUpdate.map((_, i) => i),
        required: true,
      } as any);
    } catch {
      process.exit(1);
    }

    if (updateResponse.agents && updateResponse.agents.length > 0) {
      const updateSpinner = ora(`Updating agent configurations...`).start();
      try {
        await configureAgents(updateResponse.agents, workspaceRoot, false);
        updateSpinner.succeed('Agent configurations updated.');
      } catch {
        updateSpinner.fail('Failed to update agent configurations.');
      }
    }
  }

  // then prompt for non-configured agents
  if (nonConfiguredAgents.length === 0) {
    output.success({
      title: 'All selected AI agents are already configured',
    });
    process.exit(0);
  }
  let configurationResponse: { agents: Agent[] };
  try {
    configurationResponse = await prompt<{ agents: Agent[] }>({
      type: 'multiselect',
      name: 'agents',
      message:
        'Which AI agents would you like to configure? (space to select, enter to confirm)',
      choices: nonConfiguredAgents.map((a) =>
        getAgentChoiceForPrompt(a, false, false)
      ),
      required: true,
    } as any);
  } catch {
    process.exit(1);
  }

  const selectedAgents = configurationResponse.agents;

  if (selectedAgents.length === 0) {
    output.error({
      title: 'No agents selected',
      bodyLines: ['Please select at least one AI agent to set up.'],
    });
    process.exit(0);
  }

  try {
    await configureAgents(selectedAgents, workspaceRoot, false);

    output.success({
      title: 'AI agents set up successfully',
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

// also keep duplicate in packages/create-nx-workspace/src/internal-utils/prompts.ts updated
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

type NormalizedAiAgentSetupOptions = ConfigureAiAgentsOptions & {
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
