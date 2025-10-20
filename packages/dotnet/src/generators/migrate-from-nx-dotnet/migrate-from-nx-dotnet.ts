import {
  formatFiles,
  GeneratorCallback,
  logger,
  readJson,
  readNxJson,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import {
  bold,
  code,
  h1,
  h2,
  link,
  lines as mdLines,
  orderedList,
  unorderedList,
} from 'markdown-factory';
import { MigrateFromNxDotnetSchema } from './schema';
import {
  NxDotnetConfig,
  MigrationContext,
  migrateTargetDefaults,
  migrateInferredTargets,
  migrateNugetPackages,
  migrateModuleBoundaries,
} from './migrations';

export async function migrateFromNxDotnetGenerator(
  tree: Tree,
  options: MigrateFromNxDotnetSchema
) {
  const tasks: GeneratorCallback[] = [];

  // Check for clean git state
  if (!options.skipGitCheck) {
    ensureCleanGitState();
  }

  // Check if @nx-dotnet/core is installed
  const hasNxDotnetCore = checkForNxDotnetCore(tree);
  if (!hasNxDotnetCore) {
    logger.info(
      '@nx-dotnet/core is not installed. This generator is only needed when migrating from @nx-dotnet/core.'
    );
    return;
  }

  logger.info('');
  logger.info('🔄 Starting migration from @nx-dotnet/core to @nx/dotnet');
  logger.info('');

  // Read existing configuration
  const rcConfig = readRcFile(tree);
  const hasRcFile = rcConfig !== null;

  if (hasRcFile) {
    logger.info('Found .nx-dotnet.rc.json configuration file');
  }

  // Read nx.json to check for old plugin configuration
  const nxJson = readNxJson(tree);

  // Check for multiple instances of @nx-dotnet/core
  checkForMultiplePluginInstances(nxJson);

  const oldPluginConfig = getOldPluginConfig(nxJson);

  // Disable @nx-dotnet/core plugin if present
  logger.info('');
  logger.info('Step 1: Disabling @nx-dotnet/core plugin...');
  disableNxDotnetCorePlugin(tree);

  // Migrate configuration from both .nx-dotnet.rc.json and nx.json plugin options
  const allCompleted: string[] = [];
  const allManualSteps: string[] = [];

  if (hasRcFile || oldPluginConfig) {
    logger.info('');
    if (hasRcFile && oldPluginConfig) {
      logger.info(
        'Step 2: Migrating configuration from .nx-dotnet.rc.json and @nx-dotnet/core plugin options...'
      );
    } else if (hasRcFile) {
      logger.info('Step 2: Migrating configuration from .nx-dotnet.rc.json...');
    } else {
      logger.info(
        'Step 2: Migrating configuration from @nx-dotnet/core plugin options...'
      );
    }

    // Re-read nx.json after disabling old plugin
    const nxJson = readNxJson(tree);
    const dotnetPlugin = ensureDotnetPlugin(nxJson);

    // Merge RC config with old plugin config (old plugin config takes precedence)
    const mergedConfig = mergeConfigs(rcConfig, oldPluginConfig);
    const context: MigrationContext = {
      tree,
      rcConfig: mergedConfig,
      nxJson,
      dotnetPlugin,
    };

    // Run migration chain
    const migrations = [
      migrateTargetDefaults,
      migrateInferredTargets,
      migrateNugetPackages,
      migrateModuleBoundaries,
    ];

    for (const migration of migrations) {
      const result = migration(context);
      allCompleted.push(...result.completed);
      allManualSteps.push(...result.manualSteps);
    }

    // Write updated nx.json
    updateNxJson(tree, nxJson);
  } else {
    logger.info('');
    logger.info('Step 2: No configuration found to migrate');
  }

  // Remove @nx-dotnet/core packages
  if (options.removeNxDotnetCore && !options.skipPackageJson) {
    logger.info('');
    logger.info('Step 3: Removing @nx-dotnet/core packages...');
    tasks.push(removeNxDotnetCorePackages(tree));
  }

  // Remove .nx-dotnet.rc.json
  if (hasRcFile && options.removeRcFile) {
    logger.info('');
    logger.info('Step 4: Removing .nx-dotnet.rc.json file...');
    tree.delete('.nx-dotnet.rc.json');
  }

  // Generate migration summary
  generateMigrationSummary(tree, allCompleted, allManualSteps, options);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

function ensureCleanGitState() {
  const { execSync } = require('child_process');

  try {
    const gitStatus = execSync('git status --porcelain', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    if (gitStatus) {
      throw new Error(
        'Git working directory is not clean. Please commit or stash your changes before running this migration.\n\n' +
          'This ensures you can easily undo the migration changes if needed.'
      );
    }
  } catch (error) {
    if (error.message.includes('not clean')) {
      throw error;
    }
    // If git is not available or we're not in a git repo, warn but continue
    logger.warn(
      'Could not verify git state. It is recommended to have a clean git state before running this migration.'
    );
  }
}

function checkForNxDotnetCore(tree: Tree): boolean {
  if (!tree.exists('package.json')) {
    return false;
  }

  const packageJson = readJson(tree, 'package.json');
  const deps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  return !!(
    deps['@nx-dotnet/core'] ||
    deps['@nx-dotnet/utils'] ||
    deps['@nx-dotnet/dotnet']
  );
}

function readRcFile(tree: Tree): NxDotnetConfig | null {
  const rcPath = '.nx-dotnet.rc.json';
  if (!tree.exists(rcPath)) {
    return null;
  }

  try {
    return readJson(tree, rcPath);
  } catch (error) {
    logger.warn(
      `Failed to parse .nx-dotnet.rc.json: ${error.message}. Skipping configuration migration.`
    );
    return null;
  }
}

function checkForMultiplePluginInstances(nxJson: any) {
  if (!nxJson || !nxJson.plugins) {
    return;
  }

  const oldPlugins = nxJson.plugins.filter(
    (p) =>
      (typeof p === 'string' ? p : p.plugin) === '@nx-dotnet/core' ||
      (typeof p === 'string' ? p : p.plugin) === '@nx-dotnet/dotnet'
  );

  if (oldPlugins.length > 1) {
    throw new Error(
      `Multiple instances of @nx-dotnet/core plugin detected in nx.json.\n\n` +
        `This migration generator does not support migrating from multiple plugin instances.\n` +
        `Please consolidate your @nx-dotnet/core plugin configuration into a single instance before running this migration.\n\n` +
        `Found ${oldPlugins.length} instances in nx.json plugins array.`
    );
  }
}

function getOldPluginConfig(nxJson: any): NxDotnetConfig | null {
  if (!nxJson || !nxJson.plugins) {
    return null;
  }

  const oldPlugin = nxJson.plugins.find(
    (p) =>
      (typeof p === 'string' ? p : p.plugin) === '@nx-dotnet/core' ||
      (typeof p === 'string' ? p : p.plugin) === '@nx-dotnet/dotnet'
  );

  if (!oldPlugin || typeof oldPlugin === 'string') {
    return null;
  }

  // Return the options if they exist
  return oldPlugin.options || null;
}

function mergeConfigs(
  rcConfig: NxDotnetConfig | null,
  pluginConfig: NxDotnetConfig | null
): NxDotnetConfig {
  // Plugin config takes precedence over RC file
  return {
    ...rcConfig,
    ...pluginConfig,
    // For objects/arrays, merge more carefully
    inferredTargets: {
      ...rcConfig?.inferredTargets,
      ...pluginConfig?.inferredTargets,
    },
    nugetPackages: {
      ...rcConfig?.nugetPackages,
      ...pluginConfig?.nugetPackages,
    },
    moduleBoundaries:
      pluginConfig?.moduleBoundaries || rcConfig?.moduleBoundaries || [],
  };
}

function generateMigrationSummary(
  tree: Tree,
  completed: string[],
  manualSteps: string[],
  options: MigrateFromNxDotnetSchema
) {
  // Add standard completed items
  const allCompleted = [
    'Disabled @nx-dotnet/core plugin by adding `exclude: ["*"]` to nx.json',
    ...completed,
  ];

  if (options.removeNxDotnetCore) {
    allCompleted.push('Removed @nx-dotnet/core packages from package.json');
  } else {
    allCompleted.push(
      'Kept @nx-dotnet/core packages installed (recommended until manual steps are complete)'
    );
  }

  if (options.removeRcFile && tree.exists('.nx-dotnet.rc.json')) {
    allCompleted.push('Removed .nx-dotnet.rc.json file');
  }

  // Add standard manual steps
  const allManualSteps = [...manualSteps];

  if (!options.removeNxDotnetCore) {
    allManualSteps.push(
      `After completing the above manual steps, remove @nx-dotnet/core packages by running: ${code(
        'nx g @nx/dotnet:migrate-from-nx-dotnet --removeNxDotnetCore'
      )}`
    );
  }

  // Generate markdown
  const summaryLines: string[] = [];

  summaryLines.push(
    h1('Migration from @nx-dotnet/core to @nx/dotnet'),
    h2('✅ Completed', unorderedList(...allCompleted)),
    h2(
      'Next Steps',
      orderedList(
        'Verify your project graph: ' + code('nx graph'),
        'Test your builds: ' + code('nx run-many -t build,test'),
        'Review and complete any manual migration steps below'
      )
    )
  );

  if (allManualSteps.length > 0) {
    summaryLines.push(
      h2('⚠️  Manual Migration Required', unorderedList(...allManualSteps))
    );
  }

  summaryLines.push(
    h2(
      'More Information',
      `For a complete comparison of features and migration guide, see ${link(
        'the docs',
        'TODO: add link to migration doc'
      )}.`,

      bold('Important:') +
        ' If you need to undo these changes, run: ' +
        code('git reset --hard HEAD')
    )
  );

  const markdown = mdLines(summaryLines);
  const mdFileName = 'NX_DOTNET_NEXT_STEPS.md';

  // Write the summary to a file
  tree.write(mdFileName, markdown);

  logger.info('');
  logger.info('✅ Migration completed successfully!');
  logger.info('');
  logger.info(
    `📄 A detailed migration summary has been written to ${mdFileName}`
  );
  logger.info('');
}

function disableNxDotnetCorePlugin(tree: Tree) {
  const nxJson = readNxJson(tree);
  if (!nxJson || !nxJson.plugins) {
    logger.info('  No @nx-dotnet/core plugin found to disable');
    return;
  }

  // Find @nx-dotnet/core plugin
  const nxDotnetCoreIndex = nxJson.plugins.findIndex((p) => {
    if (typeof p === 'string') {
      return p === '@nx-dotnet/core';
    }
    return p.plugin === '@nx-dotnet/core';
  });

  if (nxDotnetCoreIndex === -1) {
    logger.info('  No @nx-dotnet/core plugin found to disable');
    return;
  }

  const nxDotnetCorePlugin = nxJson.plugins[nxDotnetCoreIndex];

  // Convert to object format if it's a string
  if (typeof nxDotnetCorePlugin === 'string') {
    nxJson.plugins[nxDotnetCoreIndex] = {
      plugin: '@nx-dotnet/core',
      exclude: ['*'],
    };
    logger.info('  ✓ Disabled @nx-dotnet/core plugin (added exclude: ["*"])');
  } else {
    // Add exclude property to existing object
    nxDotnetCorePlugin.exclude = ['*'];
    logger.info('  ✓ Disabled @nx-dotnet/core plugin (added exclude: ["*"])');
  }

  updateNxJson(tree, nxJson);
}

// Helper to ensure @nx/dotnet plugin exists in nx.json
function ensureDotnetPlugin(nxJson: any): any {
  if (!nxJson.plugins) {
    nxJson.plugins = [];
  }

  let dotnetPluginIndex = nxJson.plugins.findIndex(
    (p) => (typeof p === 'string' ? p : p.plugin) === '@nx/dotnet'
  );
  let dotnetPlugin =
    dotnetPluginIndex >= 0 ? nxJson.plugins[dotnetPluginIndex] : undefined;

  // Convert string plugin to object if necessary
  if (typeof dotnetPlugin === 'string') {
    dotnetPlugin = { plugin: '@nx/dotnet', options: {} };
    nxJson.plugins[dotnetPluginIndex] = dotnetPlugin;
  } else if (!dotnetPlugin) {
    dotnetPlugin = { plugin: '@nx/dotnet', options: {} };
    nxJson.plugins.push(dotnetPlugin);
  }

  return dotnetPlugin;
}

function removeNxDotnetCorePackages(tree: Tree): GeneratorCallback {
  return removeDependenciesFromPackageJson(
    tree,
    ['@nx-dotnet/core', '@nx-dotnet/utils', '@nx-dotnet/dotnet'],
    ['@nx-dotnet/core', '@nx-dotnet/utils', '@nx-dotnet/dotnet']
  );
}

export default migrateFromNxDotnetGenerator;
