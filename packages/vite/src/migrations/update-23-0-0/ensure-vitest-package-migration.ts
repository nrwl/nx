import {
  addDependenciesToPackageJson,
  formatFiles,
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
export default async function ensureVitestPackageMigration(
  tree: Tree
): Promise<GeneratorCallback> {
  const installTask = installVitestPackageIfNeeded(tree);
  migrateExecutorUsages(tree);
  migratePluginConfigurations(tree);
  migrateTargetDefaults(tree);
  ensureVitestPluginRegistration(tree);
  await formatFiles(tree);
  return installTask;
}

function workspaceUsesVitest(tree: Tree): boolean {
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
  return hasViteTestExecutor;
}

function installVitestPackageIfNeeded(tree: Tree): GeneratorCallback {
  const packageJson = readJson(tree, 'package.json');
  const hasNxVitest =
    packageJson.dependencies?.['@nx/vitest'] ||
    packageJson.devDependencies?.['@nx/vitest'];
  if (hasNxVitest) {
    return () => {};
  }
  if (!workspaceUsesVitest(tree)) {
    return () => {};
  }
  return addDependenciesToPackageJson(tree, {}, { '@nx/vitest': nxVersion });
}

function migrateExecutorUsages(tree: Tree): void {
  const projectsToUpdate = new Set<string>();

  forEachExecutorOptions<ViteTestExecutorOptions>(
    tree,
    '@nx/vite:test',
    (_options, projectName) => {
      projectsToUpdate.add(projectName);
    }
  );

  for (const projectName of projectsToUpdate) {
    const projectConfig = readProjectConfiguration(tree, projectName);
    for (const target of Object.values(projectConfig.targets ?? {})) {
      if (target.executor === '@nx/vite:test') {
        target.executor = '@nx/vitest:test';
      }
    }
    updateProjectConfiguration(tree, projectName, projectConfig);
  }
}

function scopeKey(entry: PluginEntry): string {
  return [
    (entry.include ?? []).join(','),
    (entry.exclude ?? []).join(','),
  ].join('|');
}

function migratePluginConfigurations(tree: Tree): void {
  const nxJson = readNxJson(tree);
  if (!nxJson?.plugins) {
    return;
  }

  const newPlugins: typeof nxJson.plugins = [];
  const vitestPluginsToAdd: PluginEntry[] = [];

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
}

function ensureVitestPluginRegistration(tree: Tree): void {
  const nxJson = readNxJson(tree);
  if (!nxJson?.plugins?.length) {
    return;
  }

  const hasVitestPlugin = nxJson.plugins.some((p) =>
    typeof p === 'string' ? p === '@nx/vitest' : p.plugin === '@nx/vitest'
  );
  if (hasVitestPlugin) {
    return;
  }

  const vitePluginRegistrations = nxJson.plugins.filter((p) =>
    typeof p === 'string'
      ? p === '@nx/vite/plugin'
      : p.plugin === '@nx/vite/plugin'
  );
  if (vitePluginRegistrations.length === 0) {
    return;
  }

  for (const vitePlugin of vitePluginRegistrations) {
    if (typeof vitePlugin === 'string') {
      nxJson.plugins.push({ plugin: '@nx/vitest' });
      continue;
    }
    const vitestPlugin: {
      plugin: string;
      include?: string[];
      exclude?: string[];
    } = { plugin: '@nx/vitest' };
    if (vitePlugin.include) {
      vitestPlugin.include = vitePlugin.include as string[];
    }
    if (vitePlugin.exclude) {
      vitestPlugin.exclude = vitePlugin.exclude as string[];
    }
    nxJson.plugins.push(vitestPlugin);
  }

  updateNxJson(tree, nxJson);
}
