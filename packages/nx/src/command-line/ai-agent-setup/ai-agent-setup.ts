import { exec } from 'child_process';
import { prompt } from 'enquirer';
import { join } from 'path';
import { promisify } from 'util';
import { readNxJson } from '../../config/nx-json';
import {
  createTempNpmDirectory,
  detectPackageManager,
  getPackageManagerCommand,
} from '../../utils/package-manager';
import { ensurePackageHasProvenance } from '../../utils/provenance';
import { output } from '../../utils/output';
import { workspaceRoot } from '../../utils/workspace-root';
import { generate } from '../generate/generate';
import { AiAgentSetupOptions } from './command-object';
import { runNxAsync } from '../../utils/child-process';

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
): Promise<number> {
  // Use environment variable to force local execution
  if (process.env.NX_AI_FILES_USE_LOCAL === 'true') {
    return await aiAgentSetupHandlerImpl(args);
  }

  await ensurePackageHasProvenance('@nx/nx', 'latest');

  try {
    const getLatestHandlerResult = await getLatestHandlerUsingInstall();
    const { module: latestHandlerModule, cleanup } = getLatestHandlerResult;
    const aiAgentSetupResult =
      await latestHandlerModule.aiAgentSetupHandlerImpl(args);
    await cleanup();
    return aiAgentSetupResult;
  } catch (error) {
    // Fall back to local implementation
    return aiAgentSetupHandlerImpl(args);
  }
}

async function getLatestHandlerUsingInstall(): Promise<
  | {
      module: any;
      cleanup: () => Promise<void>;
    }
  | undefined
> {
  const { dir, cleanup } = createTempNpmDirectory(true);

  try {
    // Get package manager command
    const pmc = getPackageManagerCommand(detectPackageManager(dir), dir);

    // Install the package
    await promisify(exec)(`${pmc.add} nx@latest`, {
      cwd: dir,
    });

    let modulePath = join(
      dir,
      'node_modules',
      'nx',
      'src/command-line/ai-agent-setup/ai-agent-setup.js'
    );

    return { module: await import(modulePath), cleanup };
  } catch {
    await cleanup();
    return undefined;
  }
}

export async function aiAgentSetupHandlerImpl(
  args: AiAgentSetupOptions
): Promise<number> {
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
      console.error('Selection cancelled');
      return 1;
    }
  }

  if (selectedAgents.length === 0) {
    output.error({
      title: 'No agents selected',
      bodyLines: ['Please select at least one AI agent to set up.'],
    });
    return 1;
  }

  output.log({
    title: 'Setting up AI agents',
    bodyLines: [`Selected agents: ${selectedAgents.join(', ')}`],
  });

  try {
    // Call the existing generator
    // For now, it will generate the same files regardless of the selected agents
    // The generator can be enhanced later to handle different agents
    const result = await runNxAsync('generate ');

    if (result === 0) {
      output.success({
        title: 'AI agents set up successfully',
        bodyLines: [
          `Configuration files have been created for: ${selectedAgents.join(
            ', '
          )}`,
          'You can now use these AI agents with your Nx workspace.',
        ],
      });
    }

    return result;
  } catch (e) {
    output.error({
      title: 'Failed to set up AI agents',
      bodyLines: [e.message],
    });
    return 1;
  }
}
