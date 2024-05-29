import { registerTsProject } from '@nx/js/src/internal';
import type { Plugin } from 'esbuild';
import { loadModule } from './module-loader';

export type PluginSpec = {
  path: string;
  options: any;
};

export async function loadPlugins(
  plugins: string[] | PluginSpec[] | undefined,
  tsConfig: string
): Promise<Plugin[]> {
  if (!plugins?.length) {
    return [];
  }

  const cleanupTranspiler = registerTsProject(tsConfig);

  try {
    return await Promise.all(
      plugins.map((plugin: string | PluginSpec) => loadPlugin(plugin))
    );
  } finally {
    cleanupTranspiler();
  }
}

async function loadPlugin(pluginSpec: string | PluginSpec): Promise<Plugin> {
  const pluginPath =
    typeof pluginSpec === 'string' ? pluginSpec : pluginSpec.path;

  let plugin = await loadModule(pluginPath);

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
  const cleanupTranspiler = registerTsProject(tsConfig);

  try {
    return await Promise.all(middlewareFns.map((fnPath) => loadModule(fnPath)));
  } finally {
    cleanupTranspiler();
  }
}

export async function loadIndexHtmlTransformer(
  indexHtmlTransformerPath: string,
  tsConfig: string
): Promise<any> {
  const cleanupTranspiler = registerTsProject(tsConfig);

  try {
    return await loadModule(indexHtmlTransformerPath);
  } finally {
    cleanupTranspiler();
  }
}
