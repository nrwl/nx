import { prompt } from 'enquirer';
import { join } from 'path';
import { output } from '../../utils/output';
import { ensurePackageHasProvenance } from '../../utils/provenance';

import { installPackageToTmp } from '../../devkit-internals';
import { runNxAsync } from '../../utils/child-process';
import { AiAgentSetupOptions } from './command-object';

const availableAgents = [
  'claude',
  'codex',
  'vscode',
  'cursor',
  'gemini',
] as const;
type Agent = (typeof availableAgents)[number];

export async function aiAgentSetupHandler(
  args: AiAgentSetupOptions
): Promise<void> {
  // Use environment variable to force local execution
  if (process.env.NX_AI_FILES_USE_LOCAL === 'true') {
    return await aiAgentSetupHandlerImpl(args);
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
    const aiAgentSetupResult = await module.aiAgentSetupHandlerImpl(args);
    cleanup();
    return aiAgentSetupResult;
  } catch (error) {
    // Fall back to local implementation
    return aiAgentSetupHandlerImpl(args);
  }
}

export async function aiAgentSetupHandlerImpl(
  args: AiAgentSetupOptions
): Promise<void> {
  let selectedAgents: string[] = args.agents || [];

  // If no agents provided and interactive mode, prompt for selection
  if (selectedAgents.length === 0 && args.interactive) {
    try {
      const response = await prompt<{ agents: Agent[] }>({
        type: 'multiselect',
        name: 'agents',
        message: 'Which AI agents would you like to set up?',
        choices: availableAgents.map((agent) => ({
          name: agent,
          message: agent.charAt(0).toUpperCase() + agent.slice(1),
        })),
        required: true,
      });
      selectedAgents = response.agents;
    } catch (e) {
      return;
    }
  }

  if (selectedAgents.length === 0) {
    output.error({
      title: 'No agents selected',
      bodyLines: ['Please select at least one AI agent to set up.'],
    });
    return;
  }

  output.log({
    title: 'Setting up AI agents',
  });

  try {
    // Call the existing generator
    // For now, it will generate the same files regardless of the selected agents
    // The generator can be enhanced later to handle different agents
    await runNxAsync(
      `generate @nx/workspace:set-up-ai-agents --agents ${selectedAgents.join(
        ','
      )}`
    );

    output.success({
      title: 'AI agents set up successfully',
      bodyLines: [
        `Configuration files have been created for: ${selectedAgents.join(
          ', '
        )}`,
        'You can now use these AI agents with your Nx workspace.',
      ],
    });

    return;
  } catch (e) {
    output.error({
      title: 'Failed to set up AI agents',
      bodyLines: [e.message],
    });
  }
}
