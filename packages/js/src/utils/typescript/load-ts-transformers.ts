import { logger } from '@nx/devkit';
import { join } from 'path';
import {
  CompilerPlugin,
  CompilerPluginHooks,
  TransformerEntry,
  TransformerPlugin,
} from './types';

enum TransformerFormat {
  STANDARD, // Standard TypeScript transformer API: { before, after, afterDeclarations }
  FUNCTION_EXPORT, // Function-based: exports a function or { before: Function }
  UNKNOWN, // Unknown format
}

function detectTransformerFormat(plugin: any): TransformerFormat {
  // Check if it's a standard Nx/TypeScript transformer plugin
  if (plugin && (plugin.before || plugin.after || plugin.afterDeclarations)) {
    return TransformerFormat.STANDARD;
  }

  // Check if it's a function-based transformer (exports a function directly)
  if (typeof plugin === 'function') {
    return TransformerFormat.FUNCTION_EXPORT;
  }

  // Check if it has a 'before' function export (function-based plugin pattern)
  if (plugin && typeof plugin.before === 'function') {
    return TransformerFormat.FUNCTION_EXPORT;
  }

  return TransformerFormat.UNKNOWN;
}

function adaptFunctionBasedTransformer(
  plugin: any,
  pluginOptions: Record<string, unknown>
) {
  // Handle direct function export
  if (typeof plugin === 'function') {
    return {
      before: (options: Record<string, unknown>, program: any) =>
        plugin(options, program),
    };
  }

  // Handle { before: Function } export (function-based plugin)
  if (plugin && typeof plugin.before === 'function') {
    return {
      before: (options: Record<string, unknown>, program: any) =>
        plugin.before(options, program),
    };
  }

  return plugin;
}

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
    let plugin = pluginRefs[i];

    // Skip empty plugins (failed to load)
    if (!plugin || Object.keys(plugin).length === 0) {
      continue;
    }

    const format = detectTransformerFormat(plugin);

    // Adapt function-based transformers to standard format
    if (format === TransformerFormat.FUNCTION_EXPORT) {
      logger.debug(`Adapting function-based transformer: ${pluginName}`);
      plugin = adaptFunctionBasedTransformer(plugin, pluginOptions);
    } else if (format === TransformerFormat.UNKNOWN) {
      logger.warn(
        `${pluginName} is not a recognized Transformer Plugin format. It should export ` +
          `{ before?, after?, afterDeclarations? } functions or be a function-based transformer.`
      );
      continue;
    }

    const { before, after, afterDeclarations } = plugin;

    // Validate that at least one hook is available
    if (!before && !after && !afterDeclarations) {
      logger.warn(
        `${pluginName} does not provide any transformer hooks (before, after, or afterDeclarations).`
      );
      continue;
    }

    // Add hooks with proper error handling
    if (before) {
      try {
        beforeHooks.push((program) => before(pluginOptions, program));
      } catch (error) {
        logger.error(
          `Failed to register 'before' transformer for ${pluginName}: ${error.message}`
        );
      }
    }

    if (after) {
      try {
        afterHooks.push((program) => after(pluginOptions, program));
      } catch (error) {
        logger.error(
          `Failed to register 'after' transformer for ${pluginName}: ${error.message}`
        );
      }
    }

    if (afterDeclarations) {
      try {
        afterDeclarationsHooks.push((program) =>
          afterDeclarations(pluginOptions, program)
        );
      } catch (error) {
        logger.error(
          `Failed to register 'afterDeclarations' transformer for ${pluginName}: ${error.message}`
        );
      }
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
