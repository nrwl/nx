import { join, resolve } from 'path';
import { formatChangedFilesWithPrettierIfAvailable } from '../../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import { Tree } from '../../../generators/tree';
import { updateJson, writeJson } from '../../../generators/utils/json';
import { ensurePackageAsync } from '../../../utils/ensure-package';
import { getAgentRules } from './get-agent-rules';
import {
  NormalizedSetupAiAgentsGeneratorSchema,
  SetupAiAgentsGeneratorSchema,
} from './schema';
import { appendFileSync, readFileSync } from 'fs';

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

  try {
    // Load the 'nx/src/index' module to get the setupAiAgentsGenerator export
    await ensurePackageAsync('nx', normalizedOptions.packageVersion);

    // After ensuring the package is installed, require the specific module path
    const nxModule = require('nx/src/index');

    const { setupAiAgentsGenerator: latestSetupAiAgentsGenerator } = nxModule;

    if (!latestSetupAiAgentsGenerator) {
      return await setupAiAgentsGeneratorImpl(tree, normalizedOptions);
    }

    return await latestSetupAiAgentsGenerator(tree, normalizedOptions, true);
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

export async function setupAiAgentsGeneratorImpl(
  tree: Tree,
  options: NormalizedSetupAiAgentsGeneratorSchema
) {
  appendFileSync(
    '/Users/maxkless/Projects/nx-3/tmp/ai.log',
    `setup ai agents impl - local nx version ${
      JSON.parse(
        readFileSync(resolve(__dirname, '../../../../', 'package.json'), {
          encoding: 'utf-8',
        })
      ).version
    }\n`
  );
  const claudePath = join(options.directory, 'CLAUDE.md');
  if (!tree.exists(claudePath)) {
    tree.write(claudePath, getAgentRules(options.writeNxCloudRules));
  }
  const agentsPath = join(options.directory, 'AGENTS.md');
  if (!tree.exists(agentsPath)) {
    tree.write(agentsPath, getAgentRules(options.writeNxCloudRules));
  }

  const mcpJsonPath = join(options.directory, '.mcp.json');
  if (!tree.exists(mcpJsonPath)) {
    writeJson(tree, mcpJsonPath, {});
  }
  updateJson(tree, mcpJsonPath, mcpConfigUpdater);

  const geminiPath = join(options.directory, '.gemini', 'settings.json');
  if (!tree.exists(geminiPath)) {
    writeJson(tree, geminiPath, {});
  }
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
