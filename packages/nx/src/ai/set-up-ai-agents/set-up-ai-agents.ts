import { join } from 'path';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import { Tree } from '../../generators/tree';
import { updateJson, writeJson } from '../../generators/utils/json';
import { installPackageToTmp } from '../../utils/package-json';
import { ensurePackageHasProvenance } from '../../utils/provenance';
import { getAgentRules } from './get-agent-rules';
import {
  NormalizedSetupAiAgentsGeneratorSchema,
  SetupAiAgentsGeneratorSchema,
} from './schema';

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
    await ensurePackageHasProvenance('nx', normalizedOptions.packageVersion);

    const { tempDir, cleanup } = installPackageToTmp(
      'nx',
      normalizedOptions.packageVersion
    );

    let modulePath = join(
      tempDir,
      'node_modules',
      'nx',
      'src/ai/set-up-ai-agents/set-up-ai-agents.js'
    );

    const module = await import(modulePath);
    const setupAiAgentsGeneratorResult = await module.setupAiAgentsGenerator(
      tree,
      normalizedOptions,
      true
    );
    cleanup();
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
    agents: options.agents ?? [
      'claude',
      'codex',
      'copilot',
      'cursor',
      'gemini',
    ],
  };
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
