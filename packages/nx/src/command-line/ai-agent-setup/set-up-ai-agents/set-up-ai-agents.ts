import { exec } from 'child_process';
import {
  createTempNpmDirectory,
  detectPackageManager,
  getPackageManagerCommand,
} from '../../../utils/package-manager';
import { ensurePackageHasProvenance } from '../../../utils/provenance';
import { updateJson } from '../../../generators/utils/json';
import { join } from 'path';
import { promisify } from 'util';
import {
  NormalizedSetupAiAgentsGeneratorSchema,
  SetupAiAgentsGeneratorSchema,
} from './schema';
import { getAgentRules } from './get-agent-rules';
import { Tree } from '../../../generators/tree';
import { formatChangedFilesWithPrettierIfAvailable } from '../../../generators/internal-utils/format-changed-files-with-prettier-if-available';

export async function setupAiAgentsGenerator(
  tree: Tree,
  options: SetupAiAgentsGeneratorSchema,
  inner = false
) {
  const normalizedOptions: NormalizedSetupAiAgentsGeneratorSchema =
    normalizeOptions(options);

  // Use environment variable to force local execution
  if (process.env.NX_AI_FILES_USE_LOCAL === 'true' || inner) {
    return await setupAiAgentsGeneratorImpl(tree, normalizedOptions);
  }

  await ensurePackageHasProvenance(
    '@nx/workspace',
    normalizedOptions.packageVersion
  );

  try {
    const getLatestGeneratorResult = await getLatestGeneratorUsingInstall(
      normalizedOptions
    );
    const { module: latestGeneratorModule, cleanup } = getLatestGeneratorResult;
    const setupAiAgentsGeneratorResult =
      await latestGeneratorModule.setupAiAgentsGenerator(
        tree,
        normalizedOptions,
        true
      );
    await cleanup();
    return setupAiAgentsGeneratorResult;
  } catch (error) {
    return await setupAiAgentsGeneratorImpl(tree, normalizedOptions);
  }
}

function normalizeOptions(
  options: SetupAiAgentsGeneratorSchema
): NormalizedSetupAiAgentsGeneratorSchema {
  return {
    directory: options.directory,
    writeNxCloudRules: options.writeNxCloudRules ?? false,
    packageVersion: options.packageVersion ?? 'latest',
  };
}

async function getLatestGeneratorUsingInstall(
  options: NormalizedSetupAiAgentsGeneratorSchema
): Promise<{ module: any; cleanup: () => Promise<void> } | undefined> {
  const { dir, cleanup } = createTempNpmDirectory(true);

  try {
    // Get package manager command
    const pmc = getPackageManagerCommand(detectPackageManager(dir), dir);

    // Install the package
    await promisify(exec)(
      `${pmc.add} @nx/workspace@${options.packageVersion}`,
      {
        cwd: dir,
      }
    );

    let modulePath = join(
      dir,
      'node_modules',
      '@nx',
      'workspace',
      'src/generators/set-up-ai-agents/set-up-ai-agents.js'
    );

    return { module: await import(modulePath), cleanup };
  } catch {
    await cleanup();
    return undefined;
  }
}

export async function setupAiAgentsGeneratorImpl(
  tree: Tree,
  options: NormalizedSetupAiAgentsGeneratorSchema
) {
  const claudePath = join(options.directory, 'CLAUDE.md');
  if (!tree.exists(claudePath)) {
    tree.write(claudePath, getAgentRules(options.writeNxCloudRules));
  }
  const agentsPath = join(options.directory, 'AGENTS.md');
  if (!tree.exists(agentsPath)) {
    tree.write(agentsPath, getAgentRules(options.writeNxCloudRules));
  }

  updateJson(tree, join(options.directory, '.mcp.json'), mcpConfigUpdater);

  const geminiPath = join(options.directory, '.gemini', 'settings.json');
  updateJson(tree, geminiPath, mcpConfigUpdater);

  // Only set contextFileName to AGENTS.md if GEMINI.md doesn't exist already to preserve existing setups
  if (!tree.exists(join(options.directory, 'GEMINI.md'))) {
    updateJson(tree, geminiPath, (json) => ({
      ...json,
      contextFileName: 'AGENTS.md',
    }));
  }

  await formatChangedFilesWithPrettierIfAvailable(tree);
}

function mcpConfigUpdater(existing: any): any {
  if (existing.mcpServers) {
    existing.mcpServers['nx-mcp'] = {
      type: 'stdio',
      command: 'npx',
      args: ['nx', 'mcp'],
    };
  } else {
    existing.mcpServers = {
      'nx-mcp': {
        type: 'stdio',
        command: 'npx',
        args: ['nx', 'mcp'],
      },
    };
  }
  return existing;
}

export default setupAiAgentsGenerator;
