import { formatFiles, generateFiles, Tree } from '@nx/devkit';
import { exec } from 'child_process';
import {
  createTempNpmDirectory,
  detectPackageManager,
  getPackageManagerCommand,
} from 'nx/src/utils/package-manager';
import { ensurePackageHasProvenance } from 'nx/src/utils/provenance';
import { updateJson } from 'nx/src/generators/utils/json';
import { join } from 'path';
import { promisify } from 'util';
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
  if (!tree.exists(join(options.directory, 'CLAUDE.md'))) {
    generateFiles(tree, join(__dirname, './files'), options.directory, {
      writeNxCloudRules: options.writeNxCloudRules,
      agent: 'CLAUDE',
    });
  }
  if (!tree.exists(join(options.directory, 'AGENTS.md'))) {
    generateFiles(tree, join(__dirname, './files'), options.directory, {
      writeNxCloudRules: options.writeNxCloudRules,
      agent: 'AGENTS',
    });
  }

  addMcpConfigToJson(tree, join(options.directory, '.mcp.json'));

  const geminPath = join(options.directory, '.gemini', 'settings.json');
  addMcpConfigToJson(tree, geminPath);

  // Only set contextFileName to AGENTS.md if GEMINI.md doesn't exist already to preserve existing setups
  if (!tree.exists(join(options.directory, 'GEMINI.md'))) {
    updateJson(tree, geminPath, (json) => ({
      ...json,
      contextFileName: 'AGENTS.md',
    }));
  }

  await formatFiles(tree);
}

function addMcpConfigToJson(tree: Tree, path: string) {
  let mcpConfig: any = {};

  if (tree.exists(path)) {
    const mcpContent = tree.read(path).toString();
    mcpConfig = JSON.parse(mcpContent);
  }

  if (mcpConfig.mcpServers) {
    mcpConfig.mcpServers['nx-mcp'] = {
      type: 'stdio',
      command: 'npx',
      args: ['nx', 'mcp'],
    };
  } else {
    mcpConfig.mcpServers = {
      'nx-mcp': {
        type: 'stdio',
        command: 'npx',
        args: ['nx', 'mcp'],
      },
    };
  }
  tree.write(path, JSON.stringify(mcpConfig, null, 2));
}

export default setupAiAgentsGenerator;
