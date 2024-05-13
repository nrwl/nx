import { join } from 'path';
import { existsSync } from 'fs-extra';
import { PluginOption, Plugin } from 'vite';

/**
 * Finds exact path to the vite config within `projectRootFullPath`
 * @param projectRootFullPath root search path
 */
export function findViteConfig(projectRootFullPath: string): string {
  const allowsExt = ['js', 'mjs', 'ts', 'cjs', 'mts', 'cts'];

  for (const ext of allowsExt) {
    if (existsSync(join(projectRootFullPath, `vite.config.${ext}`))) {
      return join(projectRootFullPath, `vite.config.${ext}`);
    }
  }
}

/**
 * Wents through all vite plugins recursively
 */
function* getIterablePlugins(plugins: PluginOption[]): Generator<Plugin<any>> {
  for (const plugin of plugins) {
    if (plugin === false) continue;

    // PluginOption[]
    if (Array.isArray(plugin)) {
      yield* getIterablePlugins(plugin);
    }

    // Ignoring Promise interface for simplicity
    yield plugin as Plugin<any>;
  }
}

/**
 * Infer bundler type depending on vite.config.ts presence
 * @param root workspace root path
 */
export async function getBunlderType(
  root: string
): Promise<'classic' | 'vite'> {
  const viteConfigExists = existsSync(join(root, 'vite.config.ts'));
  if (!viteConfigExists) return 'classic';

  const viteConfigPath = findViteConfig(root);
  const { loadConfigFromFile } = await import('vite');

  const { config: viteConfig } = await loadConfigFromFile(
    {
      command: 'build',
      mode: 'watch',
    },
    viteConfigPath
  );

  const hasRemixPlugin = Array.from(
    getIterablePlugins(viteConfig.plugins)
  ).some((p) => p.name === 'remix');

  return hasRemixPlugin ? 'vite' : 'classic';
}
