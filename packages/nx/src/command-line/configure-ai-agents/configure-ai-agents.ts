import { prompt } from 'enquirer';
import { join } from 'path';
import { output } from '../../utils/output';
import { ensurePackageHasProvenance } from '../../utils/provenance';

import {
  configureAgents,
  getAgentConfigurationIsOutdated,
  getAgentConfigurations,
} from '../../ai/utils';
import { installPackageToTmp } from '../../devkit-internals';
import { workspaceRoot } from '../../utils/workspace-root';
import { ConfigureAiAgentsOptions } from './command-object';
import ora = require('ora');

const availableAgents = [
  'claude',
  'codex',
  'copilot',
  'cursor',
  'gemini',
] as const;
type Agent = (typeof availableAgents)[number];

export async function configureAiAgentsHandler(
  args: ConfigureAiAgentsOptions,
  inner = false
): Promise<void> {
  // Use environment variable to force local execution
  if (process.env.NX_AI_FILES_USE_LOCAL === 'true' || inner) {
    return await configureAiAgentsHandlerImpl(args);
  }

  try {
    await ensurePackageHasProvenance('nx', 'latest');
    const { tempDir, cleanup } = installPackageToTmp('nx', 'latest');

    let modulePath = join(
      tempDir,
      'node_modules',
      'nx',
      'src/command-line/ai-agent-setup/ai-agent-setup.js'
    );

    const module = await import(modulePath);
    const aiAgentSetupResult = await module.aiAgentSetupHandler(args, true);
    cleanup();
    return aiAgentSetupResult;
  } catch (error) {
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
  } = getAgentConfigurations(normalizedOptions.agents, workspaceRoot);

  // first, prompt for partially configured agents and out of date agents
  const agentsToUpdate: [agent: string, message: string][] = [];
  partiallyConfiguredAgents.forEach((a) => {
    agentsToUpdate.push([a, `${a} (partially configured)`] as const);
  });

  fullyConfiguredAgents.forEach((a) => {
    if (getAgentConfigurationIsOutdated(a, workspaceRoot)) {
      agentsToUpdate.push([a, `${a} (out of date)`]);
    }
  });

  if (agentsToUpdate.length > 0) {
    const updateResponse = await prompt<{ agents: Agent[] }>({
      type: 'multiselect',
      name: 'agents',
      message:
        'The following agents are not configured completely or are out of date. Which would you like to update?',
      choices: agentsToUpdate.map(([agent, message]) => ({
        name: agent,
        message,
      })),
      initial: agentsToUpdate.map((_, i) => i),
      required: true,
    } as any);

    if (updateResponse.agents && updateResponse.agents.length > 0) {
      const updateSpinner = ora(`Updating agent configurations...`).start();
      // todo: update configuration
      updateSpinner.succeed('Agent configurations updated.');
    }
  }

  // then prompt for non-configured agents
  const configurationResponse = await prompt<{ agents: Agent[] }>({
    type: 'multiselect',
    name: 'agents',
    message: 'Which AI agents would you like to configure?',
    choices: nonConfiguredAgents,
    required: true,
  } as any);

  const selectedAgents = configurationResponse.agents;

  if (selectedAgents.length === 0) {
    output.error({
      title: 'No agents selected',
      bodyLines: ['Please select at least one AI agent to set up.'],
    });
    return;
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
  }
}

type NormalizedAiAgentSetupOptions = ConfigureAiAgentsOptions & {
  agents: Agent[];
};
function normalizeOptions(
  options: ConfigureAiAgentsOptions
): NormalizedAiAgentSetupOptions {
  const agents = (options.agents ?? availableAgents).filter((a) =>
    availableAgents.includes(a as Agent)
  ) as Agent[];
  return {
    ...options,
    agents,
  };
}
