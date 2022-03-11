import { logger } from '@nrwl/devkit';
import { join } from 'path';
import {
  CompilerPlugin,
  CompilerPluginHooks,
  TransformerEntry,
  TransformerPlugin,
} from './types';

export function loadTsTransformers(
  plugins: TransformerEntry[],
  moduleResolver: typeof require.resolve = require.resolve
): {
  compilerPluginHooks: CompilerPluginHooks;
  hasPlugin: boolean;
} {
  const beforeHooks: CompilerPluginHooks['beforeHooks'] = [];
  const afterHooks: CompilerPluginHooks['afterHooks'] = [];
  const afterDeclarationsHooks: CompilerPluginHooks['afterDeclarationsHooks'] =
    [];

  if (!plugins || !plugins.length)
    return {
      compilerPluginHooks: {
        beforeHooks,
        afterHooks,
        afterDeclarationsHooks,
      },
      hasPlugin: false,
    };

  const normalizedPlugins: TransformerPlugin[] = plugins.map((plugin) =>
    typeof plugin === 'string' ? { name: plugin, options: {} } : plugin
  );

  const nodeModulePaths = [
    join(process.cwd(), 'node_modules'),
    ...module.paths,
  ];

  const pluginRefs: CompilerPlugin[] = normalizedPlugins.map(({ name }) => {
    try {
      const binaryPath = moduleResolver(name, {
        paths: nodeModulePaths,
      });
      return require(binaryPath);
    } catch (e) {
      logger.warn(`"${name}" plugin could not be found!`);
      return {};
    }
  });

  for (let i = 0; i < pluginRefs.length; i++) {
    const { name: pluginName, options: pluginOptions } = normalizedPlugins[i];
    const { before, after, afterDeclarations } = pluginRefs[i];
    if (!before && !after && !afterDeclarations) {
      logger.warn(
        `${pluginName} is not a Transformer Plugin. It does not provide neither before(), after(), nor afterDeclarations()`
      );
      continue;
    }

    if (before) {
      beforeHooks.push(before.bind(before, pluginOptions));
    }

    if (after) {
      afterHooks.push(after.bind(after, pluginOptions));
    }

    if (afterDeclarations) {
      afterDeclarationsHooks.push(
        afterDeclarations.bind(afterDeclarations, pluginOptions)
      );
    }
  }

  return {
    compilerPluginHooks: {
      beforeHooks,
      afterHooks,
      afterDeclarationsHooks,
    },
    hasPlugin: true,
  };
}
