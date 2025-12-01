import {
  addDependenciesToPackageJson,
  formatFiles,
  type GeneratorCallback,
  readJson,
  readNxJson,
  readProjectConfiguration,
  type Tree,
  updateNxJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { nxVersion } from '../../utils/versions';

interface ViteTestExecutorOptions {
  configFile?: string;
  reportsDirectory?: string;
  mode?: string;
  testFiles?: string[];
  watch?: boolean;
}

/**
 * Migrates Vitest usage from @nx/vite to @nx/vitest package.
 *
 * This migration:
 * 1. Installs @nx/vitest package if not present
 * 2. Converts @nx/vite:test executor usages to @nx/vitest:test
 * 3. Splits @nx/vite/plugin configurations to add @nx/vitest plugin
 * 4. Migrates targetDefaults from @nx/vite:test to @nx/vitest:test
 */
export default async function migrateVitestToVitestPackage(
  tree: Tree
): Promise<GeneratorCallback> {
  const installTask = installVitestPackageIfNeeded(tree);
  migrateExecutorUsages(tree);
  migratePluginConfigurations(tree);
  migrateTargetDefaults(tree);

  await formatFiles(tree);

  return installTask;
}

function installVitestPackageIfNeeded(tree: Tree): GeneratorCallback {
  const packageJson = readJson(tree, 'package.json');
  const hasVitest =
    packageJson.dependencies?.['@nx/vitest'] ||
    packageJson.devDependencies?.['@nx/vitest'];

  if (hasVitest) {
    return () => {};
  }

  return addDependenciesToPackageJson(tree, {}, { '@nx/vitest': nxVersion });
}

function migrateExecutorUsages(tree: Tree): void {
  const projectsToUpdate = new Set<string>();

  forEachExecutorOptions<ViteTestExecutorOptions>(
    tree,
    '@nx/vite:test',
    (_options, projectName, _targetName, _configuration) => {
      projectsToUpdate.add(projectName);
    }
  );

  for (const projectName of projectsToUpdate) {
    const projectConfig = readProjectConfiguration(tree, projectName);

    for (const [targetName, target] of Object.entries(
      projectConfig.targets || {}
    )) {
      if (target.executor === '@nx/vite:test') {
        target.executor = '@nx/vitest:test';
      }
    }

    updateProjectConfiguration(tree, projectName, projectConfig);
  }
}

function migratePluginConfigurations(tree: Tree): void {
  const nxJson = readNxJson(tree);
  if (!nxJson?.plugins) {
    return;
  }

  const newPlugins: typeof nxJson.plugins = [];
  const vitestPluginsToAdd: Array<{
    plugin: string;
    options?: Record<string, unknown>;
    include?: string[];
    exclude?: string[];
  }> = [];

  const hasVitestPlugin = nxJson.plugins.some((p) =>
    typeof p === 'string' ? p === '@nx/vitest' : p.plugin === '@nx/vitest'
  );

  for (const plugin of nxJson.plugins) {
    // Handle string plugin format
    if (typeof plugin === 'string') {
      newPlugins.push(plugin);
      continue;
    }

    // Handle non-vite plugins
    if (plugin.plugin !== '@nx/vite/plugin') {
      newPlugins.push(plugin);
      continue;
    }

    const options = (plugin.options as Record<string, unknown>) || {};
    const { testTargetName, ciTargetName, ciGroupName, ...viteOptions } =
      options;

    // Check if this plugin has test-related options
    if (testTargetName || ciTargetName || ciGroupName) {
      // Build vitest plugin for THIS specific vite plugin registration
      const vitestPluginOptions: Record<string, unknown> = {};
      if (testTargetName) {
        vitestPluginOptions.testTargetName = testTargetName;
      }
      if (ciTargetName) {
        vitestPluginOptions.ciTargetName = ciTargetName;
      }
      if (ciGroupName) {
        vitestPluginOptions.ciGroupName = ciGroupName;
      }

      const vitestPlugin: (typeof vitestPluginsToAdd)[0] = {
        plugin: '@nx/vitest',
      };
      if (Object.keys(vitestPluginOptions).length > 0) {
        vitestPlugin.options = vitestPluginOptions;
      }
      if (plugin.include) {
        vitestPlugin.include = plugin.include as string[];
      }
      if (plugin.exclude) {
        vitestPlugin.exclude = plugin.exclude as string[];
      }

      vitestPluginsToAdd.push(vitestPlugin);

      // Update the vite plugin to remove test options
      const updatedVitePlugin = { ...plugin };
      if (Object.keys(viteOptions).length > 0) {
        updatedVitePlugin.options = viteOptions;
      } else {
        delete updatedVitePlugin.options;
      }
      newPlugins.push(updatedVitePlugin);
    } else {
      newPlugins.push(plugin);
    }
  }

  // Add all vitest plugins if @nx/vitest not already present
  if (!hasVitestPlugin && vitestPluginsToAdd.length > 0) {
    newPlugins.push(...vitestPluginsToAdd);
  }

  nxJson.plugins = newPlugins;
  updateNxJson(tree, nxJson);
}

function migrateTargetDefaults(tree: Tree): void {
  const nxJson = readNxJson(tree);
  if (!nxJson?.targetDefaults) {
    return;
  }

  let hasChanges = false;

  for (const [targetOrExecutor, targetConfig] of Object.entries(
    nxJson.targetDefaults
  )) {
    // Pattern A: Executor-keyed (e.g., "@nx/vite:test": { ... })
    if (targetOrExecutor === '@nx/vite:test') {
      // Move config to new executor key
      nxJson.targetDefaults['@nx/vitest:test'] ??= {};
      Object.assign(nxJson.targetDefaults['@nx/vitest:test'], targetConfig);
      delete nxJson.targetDefaults['@nx/vite:test'];
      hasChanges = true;
    }
    // Pattern B: Target-name-keyed (e.g., "test": { "executor": "@nx/vite:test", ... })
    else if (targetConfig.executor === '@nx/vite:test') {
      targetConfig.executor = '@nx/vitest:test';
      hasChanges = true;
    }
  }

  if (hasChanges) {
    updateNxJson(tree, nxJson);
  }
}
