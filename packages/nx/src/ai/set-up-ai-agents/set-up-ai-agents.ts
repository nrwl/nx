import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import { Tree } from '../../generators/tree';
import { readJson, updateJson, writeJson } from '../../generators/utils/json';
import {
  canInstallNxConsoleForEditor,
  installNxConsoleForEditor,
  SupportedEditor,
} from '../../native';
import {
  CLIErrorMessageConfig,
  CLINoteMessageConfig,
} from '../../utils/output';
import { installPackageToTmp } from '../../utils/package-json';
import { ensurePackageHasProvenance } from '../../utils/provenance';
import { agentsMdPath, codexConfigTomlPath, geminiMdPath } from '../constants';
import { Agent, supportedAgents } from '../utils';
import {
  getAgentRulesWrapped,
  nxMcpTomlConfig,
  nxMcpTomlHeader,
  nxRulesMarkerCommentDescription,
  nxRulesMarkerCommentEnd,
  nxRulesMarkerCommentStart,
  rulesRegex,
} from '../constants';
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
): Promise<(check?: boolean) => Promise<ModificationResults>> {
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
    agents: options.agents ?? [...supportedAgents],
  };
}

export async function setupAiAgentsGeneratorImpl(
  tree: Tree,
  options: NormalizedSetupAiAgentsGeneratorSchema
): Promise<() => Promise<ModificationResults>> {
  const hasAgent = (agent: Agent) => options.agents.includes(agent);

  const agentsMd = agentsMdPath(options.directory);

  // write AGENTS.md for most agents
  if (hasAgent('cursor') || hasAgent('copilot') || hasAgent('codex')) {
    writeAgentRules(tree, agentsMd, options.writeNxCloudRules);
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
    const geminiSettingsPath = join(
      options.directory,
      '.gemini',
      'settings.json'
    );
    if (!tree.exists(geminiSettingsPath)) {
      writeJson(tree, geminiSettingsPath, {});
    }
    updateJson(tree, geminiSettingsPath, mcpConfigUpdater);

    const contextFileName: string | undefined = readJson(
      tree,
      geminiSettingsPath
    ).contextFileName;

    const geminiMd = geminiMdPath(options.directory);

    // Only set contextFileName to AGENTS.md if GEMINI.md doesn't exist already to preserve existing setups
    if (!contextFileName && !tree.exists(geminiMd)) {
      writeAgentRules(tree, agentsMd, options.writeNxCloudRules);
      updateJson(tree, geminiSettingsPath, (json) => ({
        ...json,
        contextFileName: 'AGENTS.md',
      }));
    } else {
      writeAgentRules(
        tree,
        contextFileName ?? geminiMd,
        options.writeNxCloudRules
      );
    }
  }

  await formatChangedFilesWithPrettierIfAvailable(tree);

  // we use the check variable to determine if we should actually make changes or just report what would be changed
  return async (check: boolean = false) => {
    const messages: CLINoteMessageConfig[] = [];
    const errors: CLIErrorMessageConfig[] = [];
    if (hasAgent('codex')) {
      if (existsSync(codexConfigTomlPath)) {
        const tomlContents = readFileSync(codexConfigTomlPath, 'utf-8');
        if (!tomlContents.includes(nxMcpTomlHeader)) {
          if (check === false) {
            appendFileSync(codexConfigTomlPath, `\n${nxMcpTomlConfig}`);
          }
          messages.push({
            title: `Updated ${codexConfigTomlPath} with nx-mcp server`,
          });
        }
      } else {
        if (check === false) {
          mkdirSync(join(homedir(), '.codex'), { recursive: true });
          writeFileSync(codexConfigTomlPath, nxMcpTomlConfig);
        }
        messages.push({
          title: `Created ${codexConfigTomlPath} with nx-mcp server`,
        });
      }
    }
    if (hasAgent('copilot')) {
      try {
        if (canInstallNxConsoleForEditor(SupportedEditor.VSCode)) {
          if (check === false) {
            installNxConsoleForEditor(SupportedEditor.VSCode);
          }
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
        if (canInstallNxConsoleForEditor(SupportedEditor.VSCodeInsiders)) {
          if (check === false) {
            installNxConsoleForEditor(SupportedEditor.VSCodeInsiders);
          }
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
        if (canInstallNxConsoleForEditor(SupportedEditor.Cursor)) {
          if (check === false) {
            installNxConsoleForEditor(SupportedEditor.Cursor);
          }
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
  const expectedRules = getAgentRulesWrapped(writeNxCloudRules);

  if (!tree.exists(path)) {
    tree.write(path, expectedRules);
    return;
  }

  const existing = tree.read(path, 'utf-8');

  const regex = rulesRegex;
  const existingNxConfiguration = existing.match(regex);

  if (existingNxConfiguration) {
    const contentOnly = (str: string) =>
      str
        .replace(nxRulesMarkerCommentStart, '')
        .replace(nxRulesMarkerCommentEnd, '')
        .replace(nxRulesMarkerCommentDescription, '')
        .replace(/\s/g, '');

    // we don't want to make updates on whitespace-only changes
    if (
      contentOnly(existingNxConfiguration[0]) === contentOnly(expectedRules)
    ) {
      return;
    }
    // otherwise replace the existing configuration
    const updatedContent = existing.replace(regex, expectedRules);
    tree.write(path, updatedContent);
  } else {
    tree.write(path, existing + '\n\n' + expectedRules);
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
