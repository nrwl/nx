import { basename } from 'path';
import postcss, { type AcceptedPlugin, type ProcessOptions } from 'postcss';
import type {
  Loader,
  LoaderContext,
  LoaderResult,
  PostCSSLoaderOptions,
} from './types';
import { humanizePath, safeIdentifier, STYLE_INJECT_PATH } from '../utils';

/**
 * Check if a file should use CSS modules based on its filename
 */
function shouldUseCSSModules(filepath: string, autoModules: boolean): boolean {
  if (!autoModules) {
    return false;
  }
  // Check for .module.xxx pattern
  const filename = basename(filepath);
  return /\.module\.[a-z]+$/i.test(filename);
}

/**
 * PostCSS loader - processes CSS through PostCSS plugins
 * This loader always runs last in the chain
 */
export function createPostCSSLoader(options: PostCSSLoaderOptions): Loader {
  return {
    name: 'postcss',
    test: /\.(css|sss|pcss|sass|scss|less|styl|stylus)$/,
    alwaysProcess: true,

    async process(code: string, context: LoaderContext): Promise<LoaderResult> {
      const { plugins, modules, autoModules, extract, inject } = options;

      // Determine if CSS modules should be used
      const shouldUseModules =
        modules || shouldUseCSSModules(context.id, autoModules);

      // Collect CSS module exports
      let cssModuleExports: Record<string, string> | undefined;

      // Build the PostCSS plugins array
      const postcssPlugins: AcceptedPlugin[] = [...plugins];

      // Add CSS modules plugin if needed
      if (shouldUseModules) {
        try {
          const postcssModules = require('postcss-modules');
          const modulesOptions = typeof modules === 'object' ? modules : {};

          postcssPlugins.unshift(
            postcssModules({
              ...modulesOptions,
              getJSON(
                _cssFilename: string,
                json: Record<string, string>,
                _outputFilename: string
              ) {
                cssModuleExports = json;
              },
            })
          );
        } catch {
          throw new Error(
            'You need to install "postcss-modules" package in order to use CSS Modules.'
          );
        }
      }

      // Process with PostCSS
      const processOptions: ProcessOptions = {
        from: context.id,
        to: context.id,
        map: context.sourceMap
          ? {
              inline: context.sourceMap === 'inline',
              annotation: false,
              sourcesContent: true,
            }
          : false,
      };

      const result = await postcss(postcssPlugins).process(
        code,
        processOptions
      );

      // Track dependencies from PostCSS messages
      for (const message of result.messages) {
        if (message.type === 'dependency') {
          context.dependencies.add(message.file);
        }
      }

      // Emit warnings
      for (const warning of result.warnings()) {
        context.warn(warning.toString());
      }

      // Get the source map
      let map: LoaderResult['map'];
      if (result.map) {
        map = result.map.toJSON() as unknown as LoaderResult['map'];
        if (map?.sources) {
          map.sources = map.sources.map(humanizePath);
        }
      }

      // If extracting CSS, return the extracted content
      if (extract) {
        return {
          code: generateModuleCode(cssModuleExports),
          map: undefined,
          extracted: {
            code: result.css,
            map,
          },
          exports: cssModuleExports,
        };
      }

      // If injecting CSS, return code that injects at runtime
      if (inject) {
        return {
          code: generateInjectCode(
            result.css,
            context.id,
            inject,
            cssModuleExports
          ),
          map: undefined,
          exports: cssModuleExports,
        };
      }

      // Otherwise return the CSS as a string export
      return {
        code: generateModuleCode(cssModuleExports, result.css),
        map,
        exports: cssModuleExports,
      };
    },
  };
}

/**
 * Generate JavaScript module code for CSS exports
 */
function generateModuleCode(
  exports?: Record<string, string>,
  css?: string
): string {
  const lines: string[] = [];

  if (exports && Object.keys(exports).length > 0) {
    // Export each class name
    for (const [key, value] of Object.entries(exports)) {
      const safeName = safeIdentifier(key);
      lines.push(`export var ${safeName} = ${JSON.stringify(value)};`);
    }

    // Default export is the full exports object
    lines.push(`export default ${JSON.stringify(exports)};`);
  } else if (css !== undefined) {
    // Export the CSS string as default
    lines.push(`export default ${JSON.stringify(css)};`);
  } else {
    // Empty export
    lines.push(`export default {};`);
  }

  return lines.join('\n');
}

/**
 * Generate JavaScript code that injects CSS at runtime
 */
function generateInjectCode(
  css: string,
  id: string,
  inject:
    | boolean
    | Record<string, unknown>
    | ((cssVar: string, id: string) => string),
  exports?: Record<string, string>
): string {
  const lines: string[] = [];

  // Import style-inject
  lines.push(`import styleInject from '${STYLE_INJECT_PATH}';`);
  lines.push('');

  // CSS string variable
  lines.push(`var css = ${JSON.stringify(css)};`);
  lines.push('');

  // Inject the CSS
  if (typeof inject === 'function') {
    // Custom inject function
    lines.push(`(${inject.toString()})('css', ${JSON.stringify(id)});`);
  } else if (typeof inject === 'object') {
    // Inject with options
    lines.push(`styleInject(css, ${JSON.stringify(inject)});`);
  } else {
    // Default inject
    lines.push(`styleInject(css);`);
  }

  lines.push('');

  // Export CSS module classes if any
  if (exports && Object.keys(exports).length > 0) {
    for (const [key, value] of Object.entries(exports)) {
      const safeName = safeIdentifier(key);
      lines.push(`export var ${safeName} = ${JSON.stringify(value)};`);
    }
    lines.push(`export default ${JSON.stringify(exports)};`);
  } else {
    lines.push(`export default css;`);
  }

  return lines.join('\n');
}
