import {
  addDependenciesToPackageJson,
  formatFiles,
  globAsync,
  readJson,
  readNxJson,
  readProjectConfiguration,
  type GeneratorCallback,
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

type PluginEntry = {
  plugin: string;
  options?: Record<string, unknown>;
  include?: string[];
  exclude?: string[];
};

// v23 safety net — @nx/vite:test executor + plugin test inference removed.
// - swap @nx/vite:test → @nx/vitest:test (project + targetDefaults)
// - register @nx/vitest plugin alongside default-config @nx/vite/plugin (v22 gap)
// - install @nx/vitest only when at least one of the above actually fired
export default async function ensureVitestPackageMigration(
  tree: Tree
): Promise<GeneratorCallback> {
  const migratedExecutors = migrateExecutorUsages(tree);
  const migratedPlugins = migratePluginConfigurations(tree);
  const migratedTargetDefaults = migrateTargetDefaults(tree);
  const registeredVitestPlugin = await ensureVitestPluginRegistration(tree);

  await formatFiles(tree);

  if (
    migratedExecutors ||
    migratedPlugins ||
    migratedTargetDefaults ||
    registeredVitestPlugin
  ) {
    return installVitestPackage(tree);
  }
  return () => {};
}

function installVitestPackage(tree: Tree): GeneratorCallback {
  const packageJson = readJson(tree, 'package.json');
  const hasNxVitest =
    packageJson.dependencies?.['@nx/vitest'] ||
    packageJson.devDependencies?.['@nx/vitest'];
  if (hasNxVitest) {
    return () => {};
  }
  return addDependenciesToPackageJson(tree, {}, { '@nx/vitest': nxVersion });
}

function migrateExecutorUsages(tree: Tree): boolean {
  const projectsToUpdate = new Set<string>();

  forEachExecutorOptions<ViteTestExecutorOptions>(
    tree,
    '@nx/vite:test',
    (_options, projectName) => {
      projectsToUpdate.add(projectName);
    }
  );

  if (projectsToUpdate.size === 0) {
    return false;
  }

  for (const projectName of projectsToUpdate) {
    const projectConfig = readProjectConfiguration(tree, projectName);
    for (const target of Object.values(projectConfig.targets ?? {})) {
      if (target.executor === '@nx/vite:test') {
        target.executor = '@nx/vitest:test';
      }
    }
    updateProjectConfiguration(tree, projectName, projectConfig);
  }
  return true;
}

function scopeKey(entry: PluginEntry): string {
  return [
    (entry.include ?? []).join(','),
    (entry.exclude ?? []).join(','),
  ].join('|');
}

function migratePluginConfigurations(tree: Tree): boolean {
  const nxJson = readNxJson(tree);
  if (!nxJson?.plugins) {
    return false;
  }

  const newPlugins: typeof nxJson.plugins = [];
  const vitestPluginsToAdd: PluginEntry[] = [];
  let changed = false;

  for (const plugin of nxJson.plugins) {
    if (typeof plugin === 'string') {
      newPlugins.push(plugin);
      continue;
    }
    if (plugin.plugin !== '@nx/vite/plugin') {
      newPlugins.push(plugin);
      continue;
    }

    const options = (plugin.options as Record<string, unknown>) || {};
    const { testTargetName, ciTargetName, ciGroupName, ...viteOptions } =
      options;

    if (testTargetName || ciTargetName || ciGroupName) {
      const vitestPluginOptions: Record<string, unknown> = {};
      if (testTargetName) vitestPluginOptions.testTargetName = testTargetName;
      if (ciTargetName) vitestPluginOptions.ciTargetName = ciTargetName;
      if (ciGroupName) vitestPluginOptions.ciGroupName = ciGroupName;

      const vitestPlugin: PluginEntry = { plugin: '@nx/vitest' };
      if (Object.keys(vitestPluginOptions).length > 0) {
        vitestPlugin.options = vitestPluginOptions;
      }
      if (plugin.include) vitestPlugin.include = plugin.include as string[];
      if (plugin.exclude) vitestPlugin.exclude = plugin.exclude as string[];
      vitestPluginsToAdd.push(vitestPlugin);

      const updatedVitePlugin = { ...plugin };
      if (Object.keys(viteOptions).length > 0) {
        updatedVitePlugin.options = viteOptions;
      } else {
        delete updatedVitePlugin.options;
      }
      newPlugins.push(updatedVitePlugin);
      changed = true;
    } else {
      newPlugins.push(plugin);
    }
  }

  for (const candidate of vitestPluginsToAdd) {
    const key = scopeKey(candidate);
    const existingIdx = newPlugins.findIndex((p) => {
      if (typeof p === 'string') {
        return p === '@nx/vitest' && !candidate.include && !candidate.exclude;
      }
      return p.plugin === '@nx/vitest' && scopeKey(p as PluginEntry) === key;
    });

    if (existingIdx !== -1) {
      if (candidate.options) {
        const existing = newPlugins[existingIdx];
        if (typeof existing === 'string') {
          newPlugins[existingIdx] = {
            plugin: '@nx/vitest',
            options: { ...candidate.options },
          };
        } else {
          (existing as PluginEntry).options = {
            ...candidate.options,
            ...((existing as PluginEntry).options ?? {}),
          };
        }
      }
    } else {
      newPlugins.push(candidate);
    }
  }

  if (!changed) {
    return false;
  }

  nxJson.plugins = newPlugins;
  updateNxJson(tree, nxJson);
  return true;
}

function migrateTargetDefaults(tree: Tree): boolean {
  const nxJson = readNxJson(tree);
  if (!nxJson?.targetDefaults) {
    return false;
  }

  let hasChanges = false;
  for (const [targetOrExecutor, targetConfig] of Object.entries(
    nxJson.targetDefaults
  )) {
    if (targetOrExecutor === '@nx/vite:test') {
      nxJson.targetDefaults['@nx/vitest:test'] ??= {};
      Object.assign(nxJson.targetDefaults['@nx/vitest:test'], targetConfig);
      delete nxJson.targetDefaults['@nx/vite:test'];
      hasChanges = true;
    } else if (targetConfig.executor === '@nx/vite:test') {
      targetConfig.executor = '@nx/vitest:test';
      hasChanges = true;
    }
  }

  if (hasChanges) {
    updateNxJson(tree, nxJson);
  }
  return hasChanges;
}

async function ensureVitestPluginRegistration(tree: Tree): Promise<boolean> {
  const nxJson = readNxJson(tree);
  if (!nxJson?.plugins?.length) {
    return false;
  }

  const hasVitestPlugin = nxJson.plugins.some((p) =>
    typeof p === 'string' ? p === '@nx/vitest' : p.plugin === '@nx/vitest'
  );
  if (hasVitestPlugin) {
    return false;
  }

  const vitePluginRegistrations = nxJson.plugins.filter((p) =>
    typeof p === 'string'
      ? p === '@nx/vite/plugin'
      : p.plugin === '@nx/vite/plugin'
  );
  if (vitePluginRegistrations.length === 0) {
    return false;
  }

  // Only register @nx/vitest when the workspace actually uses vitest.
  // Otherwise we'd add a plugin (and trigger an install) for vite-only setups.
  if (!(await workspaceUsesVitest(tree))) {
    return false;
  }

  for (const vitePlugin of vitePluginRegistrations) {
    if (typeof vitePlugin === 'string') {
      nxJson.plugins.push({ plugin: '@nx/vitest' });
      continue;
    }
    const vitestPlugin: PluginEntry = { plugin: '@nx/vitest' };
    if (vitePlugin.include) {
      vitestPlugin.include = vitePlugin.include as string[];
    }
    if (vitePlugin.exclude) {
      vitestPlugin.exclude = vitePlugin.exclude as string[];
    }
    nxJson.plugins.push(vitestPlugin);
  }

  updateNxJson(tree, nxJson);
  return true;
}

async function workspaceUsesVitest(tree: Tree): Promise<boolean> {
  const packageJson = readJson(tree, 'package.json');
  if (
    packageJson.dependencies?.['vitest'] ||
    packageJson.devDependencies?.['vitest']
  ) {
    return true;
  }

  let hasViteTestExecutor = false;
  forEachExecutorOptions(tree, '@nx/vite:test', () => {
    hasViteTestExecutor = true;
  });
  if (hasViteTestExecutor) {
    return true;
  }

  // Inference-only setup: vitest.config.* anywhere, or vite.config.* with a
  // top-level `test:` key. Catches workspaces that relied on @nx/vite/plugin's
  // test inference without an explicit executor or root vitest dep.
  const configFiles = await globAsync(tree, [
    '**/{vite,vitest}.config.{js,ts,mjs,mts,cjs,cts}',
  ]);
  for (const configFile of configFiles) {
    if (configFile.includes('vitest.config')) {
      return true;
    }
    const content = tree.read(configFile, 'utf-8') ?? '';
    // Heuristic: bias toward over-install. A commented-out `test:` line will
    // false-positive — safer than missing real usage and silently dropping
    // inferred test targets.
    if (/(^|[\s,{])test\s*:/m.test(content)) {
      return true;
    }
  }
  return false;
}
