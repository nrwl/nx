import { join } from 'path';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import { Tree } from '../../generators/tree';
import { updateJson, writeJson } from '../../generators/utils/json';
import { installPackageToTmp } from '../../utils/package-json';
import { ensurePackageHasProvenance } from '../../utils/provenance';
import {
  NormalizedSetupAiAgentsGeneratorSchema,
  SetupAiAgentsGeneratorSchema,
} from './schema';
import { Agent, getAgentRulesWrapped, rulesRegex } from '../utils';

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
    agents: options.agents ?? ['claude', 'gemini'],
  };
}

export async function setupAiAgentsGeneratorImpl(
  tree: Tree,
  options: NormalizedSetupAiAgentsGeneratorSchema
) {
  const hasAgent = (agent: Agent) => options.agents.includes(agent);

  // write AGENTS.md for most agents
  if (
    hasAgent('gemini') ||
    hasAgent('cursor') ||
    hasAgent('copilot') ||
    hasAgent('codex')
  ) {
    const agentsPath = join(options.directory, 'AGENTS.md');
    writeAgentRules(tree, agentsPath, options.writeNxCloudRules);
  }

  if (hasAgent('claude')) {
    const claudePath = join(options.directory, 'CLAUDE.md');
    writeAgentRules(tree, claudePath, options.writeNxCloudRules);

    const mcpJsonPath = join(options.directory, '.mcp.json');
    if (!tree.exists(mcpJsonPath)) {
      writeJson(tree, mcpJsonPath, {});
    }
    updateJson(tree, mcpJsonPath, mcpConfigUpdater);
  }

  if (hasAgent('gemini')) {
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
  }

  await formatChangedFilesWithPrettierIfAvailable(tree);
}

function writeAgentRules(tree: Tree, path: string, writeNxCloudRules: boolean) {
  const agentRulesWithMarkers = getAgentRulesWrapped(writeNxCloudRules);

  if (!tree.exists(path)) {
    tree.write(path, agentRulesWithMarkers);
    return;
  }

  const existing = tree.read(path, 'utf-8');

  const regex = rulesRegex;
  const existingNxConfiguration = existing.match(regex);

  if (existingNxConfiguration) {
    const updatedContent = existing.replace(regex, agentRulesWithMarkers);
    tree.write(path, updatedContent);
  } else {
    tree.write(path, existing + '\n\n' + agentRulesWithMarkers);
  }
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
