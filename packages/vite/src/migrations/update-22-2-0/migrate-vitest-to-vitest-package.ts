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
  let needsVitestPlugin = false;
  const vitestPluginOptions: Record<string, unknown> = {};
  let vitestInclude: string[] | undefined;
  let vitestExclude: string[] | undefined;

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
      // Only collect test options once (from first entry found)
      if (!needsVitestPlugin) {
        needsVitestPlugin = true;

        if (testTargetName) {
          vitestPluginOptions.testTargetName = testTargetName;
        }
        if (ciTargetName) {
          vitestPluginOptions.ciTargetName = ciTargetName;
        }
        if (ciGroupName) {
          vitestPluginOptions.ciGroupName = ciGroupName;
        }

        // Track include/exclude for vitest plugin
        if (plugin.include) {
          vitestInclude = plugin.include as string[];
        }
        if (plugin.exclude) {
          vitestExclude = plugin.exclude as string[];
        }
      }

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

  // Add @nx/vitest plugin if needed and not already present
  if (needsVitestPlugin && !hasVitestPlugin) {
    const vitestPlugin: {
      plugin: string;
      options?: Record<string, unknown>;
      include?: string[];
      exclude?: string[];
    } = { plugin: '@nx/vitest' };

    if (Object.keys(vitestPluginOptions).length > 0) {
      vitestPlugin.options = vitestPluginOptions;
    }
    if (vitestInclude) {
      vitestPlugin.include = vitestInclude;
    }
    if (vitestExclude) {
      vitestPlugin.exclude = vitestExclude;
    }

    newPlugins.push(vitestPlugin);
  }

  nxJson.plugins = newPlugins;
  updateNxJson(tree, nxJson);
}

function migrateTargetDefaults(tree: Tree): void {
  const nxJson = readNxJson(tree);
  if (!nxJson?.targetDefaults?.['@nx/vite:test']) {
    return;
  }

  const viteTestDefaults = nxJson.targetDefaults['@nx/vite:test'];
  nxJson.targetDefaults['@nx/vitest:test'] ??= {};
  Object.assign(nxJson.targetDefaults['@nx/vitest:test'], viteTestDefaults);
  delete nxJson.targetDefaults['@nx/vite:test'];

  updateNxJson(tree, nxJson);
}
