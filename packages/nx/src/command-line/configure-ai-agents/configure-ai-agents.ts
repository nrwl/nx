import { prompt } from 'enquirer';
import { join } from 'path';
import { output } from '../../utils/output';
import { ensurePackageHasProvenance } from '../../utils/provenance';

import {
  Agent,
  availableAgents,
  configureAgents,
  getAgentConfigurationIsOutdated,
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
    agentConfigurations,
  } = getAgentConfigurations(normalizedOptions.agents, workspaceRoot);

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

    const outOfDateAgents: Agent[] = [];
    for (const a of fullyConfiguredAgents) {
      const isOutdated = await getAgentConfigurationIsOutdated(
        a,
        agentConfigurations.get(a),
        workspaceRoot
      );
      if (isOutdated.mcpOutdated || isOutdated.rulesOutdated) {
        outOfDateAgents.push(a);
      }
    }

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
  const agentsToUpdate: [agent: string, message: string][] = [];
  partiallyConfiguredAgents.forEach((a) => {
    agentsToUpdate.push([a, `${a} (partially configured)`] as const);
  });

  for (const a of fullyConfiguredAgents) {
    const isOutdated = await getAgentConfigurationIsOutdated(
      a,
      agentConfigurations.get(a),
      workspaceRoot
    );
    if (isOutdated.mcpOutdated || isOutdated.rulesOutdated) {
      agentsToUpdate.push([a, `${a} (out of date)`]);
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
        choices: agentsToUpdate.map(([agent, message]) => ({
          name: agent,
          message,
        })),
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
      message: 'Which AI agents would you like to configure?',
      choices: nonConfiguredAgents,
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
    process.exit(1);
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
    check: options.check ?? false,
  };
}
