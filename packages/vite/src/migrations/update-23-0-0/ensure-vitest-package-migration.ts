import {
  addDependenciesToPackageJson,
  type ExpandedPluginConfiguration,
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

type PluginEntry = ExpandedPluginConfiguration<Record<string, unknown>>;

// @nx/vite no longer infers vitest targets, nor provides vitest executor.
// - swap @nx/vite:test -> @nx/vitest:test
// - register @nx/vitest plugin
export default async function ensureVitestPackageMigration(
  tree: Tree
): Promise<GeneratorCallback> {
  const migratedExecutors = migrateExecutorUsages(tree);
  const migratedPlugins = migratePluginConfigurations(tree);
  const migratedTargetDefaults = migrateTargetDefaults(tree);
  const registeredVitestPlugin = await ensureVitestPluginRegistration(tree);
  if (
    migratedExecutors ||
    migratedPlugins ||
    migratedTargetDefaults ||
    registeredVitestPlugin
  ) {
    const installTask = installVitestPackage(tree);
    await formatFiles(tree);
    return installTask;
  } else {
    return () => {};
  }
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

  forEachExecutorOptions(tree, '@nx/vite:test', (_options, projectName) => {
    projectsToUpdate.add(projectName);
  });

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

function migratePluginConfigurations(tree: Tree): boolean {
  const nxJson = readNxJson(tree);
  if (!nxJson?.plugins) {
    return false;
  }

  const newPlugins: typeof nxJson.plugins = [];
  let changed = false;

  for (const plugin of nxJson.plugins) {
    if (typeof plugin === 'string' || plugin.plugin !== '@nx/vite/plugin') {
      newPlugins.push(plugin);
      continue;
    }

    const options = (plugin.options as Record<string, unknown>) || {};
    const { testTargetName, ciTargetName, ciGroupName, ...viteOptions } =
      options;

    if (!testTargetName && !ciTargetName && !ciGroupName) {
      newPlugins.push(plugin);
      continue;
    }

    const vitestOptions: Record<string, unknown> = {};
    if (testTargetName) vitestOptions.testTargetName = testTargetName;
    if (ciTargetName) vitestOptions.ciTargetName = ciTargetName;
    if (ciGroupName) vitestOptions.ciGroupName = ciGroupName;

    const vitestPlugin: PluginEntry = { plugin: '@nx/vitest' };
    if (Object.keys(vitestOptions).length > 0) {
      vitestPlugin.options = vitestOptions;
    }
    if (plugin.include) vitestPlugin.include = plugin.include as string[];
    if (plugin.exclude) vitestPlugin.exclude = plugin.exclude as string[];

    const updatedVitePlugin = { ...plugin };
    if (Object.keys(viteOptions).length > 0) {
      updatedVitePlugin.options = viteOptions;
    } else {
      delete updatedVitePlugin.options;
    }
    newPlugins.push(updatedVitePlugin);
    newPlugins.push(vitestPlugin);
    changed = true;
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

  // Skip @nx/vite/plugin entries whose scope already has a matching @nx/vitest.
  // Mixed-shape configs (one scope split by migratePluginConfigurations, another
  // bare) need per-scope checks rather than a global short-circuit.
  const coveredScopes = new Set(
    nxJson.plugins
      .filter((p) =>
        typeof p === 'string' ? p === '@nx/vitest' : p.plugin === '@nx/vitest'
      )
      .map((p) => scopeKey(typeof p === 'string' ? { plugin: p } : p))
  );

  let added = false;
  for (const vitePlugin of vitePluginRegistrations) {
    const vitestPlugin: PluginEntry = { plugin: '@nx/vitest' };
    if (typeof vitePlugin !== 'string') {
      if (vitePlugin.include) {
        vitestPlugin.include = vitePlugin.include as string[];
      }
      if (vitePlugin.exclude) {
        vitestPlugin.exclude = vitePlugin.exclude as string[];
      }
    }
    if (coveredScopes.has(scopeKey(vitestPlugin))) {
      continue;
    }
    nxJson.plugins.push(vitestPlugin);
    coveredScopes.add(scopeKey(vitestPlugin));
    added = true;
  }

  if (!added) {
    return false;
  }
  updateNxJson(tree, nxJson);
  return true;
}

function scopeKey(entry: { include?: string[]; exclude?: string[] }): string {
  return [
    (entry.include ?? []).join(','),
    (entry.exclude ?? []).join(','),
  ].join('|');
}

async function workspaceUsesVitest(tree: Tree): Promise<boolean> {
  const packageJson = readJson(tree, 'package.json');
  if (
    packageJson.dependencies?.['vitest'] ||
    packageJson.devDependencies?.['vitest']
  ) {
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
    // Bias toward over-install: a commented-out `test:` will false-positive,
    // which is safer than missing real usage and dropping inferred targets.
    if (/(^|[\s,{])test\s*:/m.test(content)) {
      return true;
    }
  }
  return false;
}
