import type { IndexHtmlTransform } from '@angular-devkit/build-angular/src/utils/index-file/index-html-generator';
import { registerTsProject } from '@nx/js/src/internal';
import type { Plugin } from 'esbuild';
import type { Connect } from 'vite';
import { loadModule } from './module-loader';
import { ExecutorContext } from '@nx/devkit';

export type PluginSpec = {
  path: string;
  options: any;
};

export async function loadPlugins(
  plugins: string[] | PluginSpec[] | undefined,
  tsConfig: string,
  context: ExecutorContext | import('@angular-devkit/architect').BuilderContext
): Promise<Plugin[]> {
  if (!plugins?.length) {
    return [];
  }

  const runtimeVariables = new Map<string, unknown>([
    ['<ExecutorContext>', context],
  ]);

  const cleanupTranspiler = registerTsProject(tsConfig);

  try {
    return await Promise.all(
      plugins.map((plugin: string | PluginSpec) =>
        loadPlugin(plugin, runtimeVariables)
      )
    );
  } finally {
    cleanupTranspiler();
  }
}

async function loadPlugin(
  pluginSpec: string | PluginSpec,
  runtimeVariables: ReadonlyMap<string, unknown>
): Promise<Plugin> {
  const pluginPath =
    typeof pluginSpec === 'string' ? pluginSpec : pluginSpec.path;

  let plugin = await loadModule(pluginPath);

  if (typeof plugin === 'function') {
    if (typeof pluginSpec === 'object') {
      const options = pluginSpec.options;
      updateOptionsWithRuntimeVariablesInPlace(options, runtimeVariables);
      plugin = plugin(options);
    } else {
      plugin = plugin();
    }
  }

  return plugin;
}

function updateOptionsWithRuntimeVariablesInPlace(
  options: PluginSpec['options'],
  runtimeVariables: ReadonlyMap<string, unknown>
) {
  if (typeof options !== 'object' || Array.isArray(options)) {
    return;
  }
  for (const key in options) {
    if (runtimeVariables.has(options[key])) {
      options[key] = runtimeVariables.get(options[key]);
    }
  }
}

export async function loadMiddleware(
  middlewareFns: string[] | undefined,
  tsConfig: string
): Promise<Connect.NextHandleFunction[]> {
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
): Promise<IndexHtmlTransform> {
  const cleanupTranspiler = registerTsProject(tsConfig);

  try {
    return await loadModule(indexHtmlTransformerPath);
  } finally {
    cleanupTranspiler();
  }
}
