import {
  appendFileSync,
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import { Tree } from '../../generators/tree';
import { updateJson, writeJson } from '../../generators/utils/json';
import {
  canInstallNxConsoleForEditor,
  installNxConsoleForEditor,
} from '../../native';
import {
  CLIErrorMessageConfig,
  CLINoteMessageConfig,
} from '../../utils/output';
import { installPackageToTmp } from '../../utils/package-json';
import { ensurePackageHasProvenance } from '../../utils/provenance';
import { codexConfigTomlPath } from '../config-paths';
import {
  Agent,
  getAgentRulesWrapped,
  nxMcpTomlConfig,
  nxMcpTomlHeader,
  rulesRegex,
} from '../utils';
import {
  NormalizedSetupAiAgentsGeneratorSchema,
  SetupAiAgentsGeneratorSchema,
} from './schema';

export type ModificationResults = {
  messages: CLINoteMessageConfig[];
  errors: CLIErrorMessageConfig[];
};

export async function setupAiAgentsGenerator(
  tree: Tree,
  options: SetupAiAgentsGeneratorSchema,
  inner = false
): Promise<() => Promise<ModificationResults>> {
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
): Promise<() => Promise<ModificationResults>> {
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

  return async () => {
    const messages: CLINoteMessageConfig[] = [];
    const errors: CLIErrorMessageConfig[] = [];
    if (hasAgent('codex')) {
      if (existsSync(codexConfigTomlPath)) {
        const tomlContents = readFileSync(codexConfigTomlPath, 'utf-8');
        if (!tomlContents.includes(nxMcpTomlHeader)) {
          appendFileSync(codexConfigTomlPath, `\n${nxMcpTomlConfig}`);
          messages.push({
            title: `Updated ${codexConfigTomlPath} with nx-mcp server`,
          });
        }
      } else {
        mkdirSync(join(homedir(), '.codex'), { recursive: true });
        writeFileSync(codexConfigTomlPath, nxMcpTomlConfig);
        messages.push({
          title: `Created ${codexConfigTomlPath} with nx-mcp server`,
        });
      }
    }
    if (hasAgent('copilot')) {
      try {
        if (canInstallNxConsoleForEditor('vscode')) {
          installNxConsoleForEditor('vscode');
          messages.push({
            title: `Installed Nx Console for VSCode`,
          });
        }
      } catch (e) {
        errors.push({
          title: `Failed to install Nx Console for VSCode. Please install it manually.`,
          bodyLines: [(e as Error).message],
        });
      }
      try {
        if (canInstallNxConsoleForEditor('vscode-insiders')) {
          installNxConsoleForEditor('vscode-insiders');
          messages.push({
            title: `Installed Nx Console for VSCode Insiders`,
          });
        }
      } catch (e) {
        errors.push({
          title: `Failed to install Nx Console for VSCode Insiders. Please install it manually.`,
          bodyLines: [(e as Error).message],
        });
      }
    }
    if (hasAgent('cursor')) {
      try {
        if (canInstallNxConsoleForEditor('cursor')) {
          installNxConsoleForEditor('cursor');
          messages.push({
            title: `Installed Nx Console for Cursor`,
          });
        }
      } catch (e) {
        errors.push({
          title: `Failed to install Nx Console for Cursor. Please install it manually.`,
          bodyLines: [(e as Error).message],
        });
      }
    }
    return {
      messages,
      errors,
    };
  };
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
