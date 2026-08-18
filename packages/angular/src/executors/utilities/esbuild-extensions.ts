import type { buildApplication } from '@angular/build';
import { workspaceRoot } from '@nx/devkit';
import { existsSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { loadModule } from './module-loader';

// This is a workaround to make sure we use the same esbuild version as the
// Angular DevKit uses. This is only used internally to load the plugins and
// forward them to the Angular DevKit builders.
type Plugin = Parameters<typeof buildApplication>[2]['codePlugins'][number];

export type PluginSpec = {
  path: string;
  options: any;
};

// Nx strips {workspaceRoot}/ and expands {projectRoot} in option paths to a
// path relative to the workspace root, but require() would resolve that against
// this file's directory. Anchor it to the workspace root, while leaving bare
// package specifiers (e.g. an esbuild plugin shipped as a package) untouched.
function resolveModulePath(path: string): string {
  if (isAbsolute(path)) {
    return path;
  }
  const candidate = join(workspaceRoot, path);
  return existsSync(candidate) ? candidate : path;
}

export async function loadPlugins(
  plugins: string[] | PluginSpec[] | undefined,
  tsConfig: string
): Promise<Plugin[]> {
  if (!plugins?.length) {
    return [];
  }

  return Promise.all(
    plugins.map((plugin: string | PluginSpec) => loadPlugin(plugin, tsConfig))
  );
}

async function loadPlugin(
  pluginSpec: string | PluginSpec,
  tsConfig: string
): Promise<Plugin> {
  const pluginPath =
    typeof pluginSpec === 'string' ? pluginSpec : pluginSpec.path;

  let plugin = await loadModule(resolveModulePath(pluginPath), tsConfig);

  if (typeof plugin === 'function') {
    plugin =
      typeof pluginSpec === 'object' ? plugin(pluginSpec.options) : plugin();
  }

  return plugin;
}

export async function loadMiddleware(
  middlewareFns: string[] | undefined,
  tsConfig: string
): Promise<any[]> {
  if (!middlewareFns?.length) {
    return [];
  }
  return Promise.all(
    middlewareFns.map((fnPath) =>
      loadModule(resolveModulePath(fnPath), tsConfig)
    )
  );
}

export async function loadIndexHtmlTransformer(
  indexHtmlTransformerPath: string,
  tsConfig: string
): Promise<any> {
  return loadModule(resolveModulePath(indexHtmlTransformerPath), tsConfig);
}
