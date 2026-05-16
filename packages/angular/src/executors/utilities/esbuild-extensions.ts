import type { buildApplication } from '@angular/build';
import { loadModule } from './module-loader';

// This is a workaround to make sure we use the same esbuild version as the
// Angular DevKit uses. This is only used internally to load the plugins and
// forward them to the Angular DevKit builders.
type Plugin = Parameters<typeof buildApplication>[2]['codePlugins'][number];

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

  let plugin = await loadModule(pluginPath, tsConfig);

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
    middlewareFns.map((fnPath) => loadModule(fnPath, tsConfig))
  );
}

export async function loadIndexHtmlTransformer(
  indexHtmlTransformerPath: string,
  tsConfig: string
): Promise<any> {
  return loadModule(indexHtmlTransformerPath, tsConfig);
}
