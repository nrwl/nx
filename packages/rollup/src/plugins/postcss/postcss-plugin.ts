import { basename, extname, relative } from 'path';
import type { Plugin, PluginContext, SourceMapInput } from 'rollup';
import type {
  PostCSSPluginOptions,
  FilterPattern,
  NormalizedPostCSSOptions,
} from './options';
import { normalizeOptions } from './options';
import { Loaders } from './loaders';
import type { LoaderResult } from './loaders';
import {
  normalizePath,
  styleInjectCode,
  STYLE_INJECT_ID,
  STYLE_INJECT_PATH,
} from './utils';

// Use require for modules that don't have proper ES module exports
const Concat = require('concat-with-sourcemaps');
const picomatch = require('picomatch');

interface ExtractedCSS {
  id: string;
  code: string;
  map?: LoaderResult['map'];
}

/**
 * Convert a source map from loader format to Rollup format
 */
function toRollupSourceMap(
  map: LoaderResult['map']
): SourceMapInput | undefined {
  if (!map) return undefined;
  // Rollup expects version as number, but source-map-js uses string
  // Convert to Rollup-compatible format
  return {
    ...map,
    version:
      typeof map.version === 'string' ? parseInt(map.version, 10) : map.version,
  } as SourceMapInput;
}

/**
 * Create a file filter from include/exclude patterns
 */
function createFilter(
  include?: FilterPattern,
  exclude?: FilterPattern
): (id: string) => boolean {
  const includeMatchers = include
    ? (Array.isArray(include) ? include : [include]).map((p) =>
        typeof p === 'string' ? picomatch(p) : (id: string) => p.test(id)
      )
    : [];

  const excludeMatchers = exclude
    ? (Array.isArray(exclude) ? exclude : [exclude]).map((p) =>
        typeof p === 'string' ? picomatch(p) : (id: string) => p.test(id)
      )
    : [];

  return (id: string) => {
    const normalizedId = normalizePath(id);

    // If exclude matches, reject
    if (
      excludeMatchers.length > 0 &&
      excludeMatchers.some((m) => m(normalizedId))
    ) {
      return false;
    }

    // If include is specified, only accept if it matches
    if (includeMatchers.length > 0) {
      return includeMatchers.some((m) => m(normalizedId));
    }

    // Default: accept all
    return true;
  };
}

/**
 * Get the output filename for extracted CSS
 */
function getExtractedFilename(
  extract: boolean | string,
  chunkName: string
): string {
  if (typeof extract === 'string') {
    return extract;
  }
  return `${chunkName}.css`;
}

/**
 * Recursively get the import order for CSS files
 * This ensures CSS is concatenated in the correct dependency order
 */
function getRecursiveImportOrder(
  id: string,
  moduleGraph: Map<string, Set<string>>,
  visited = new Set<string>()
): string[] {
  if (visited.has(id)) {
    return [];
  }
  visited.add(id);

  const imports = moduleGraph.get(id);
  if (!imports) {
    return [id];
  }

  const result: string[] = [];
  for (const importId of imports) {
    result.push(...getRecursiveImportOrder(importId, moduleGraph, visited));
  }
  result.push(id);

  return result;
}

/**
 * PostCSS Rollup plugin
 *
 * Processes CSS files through PostCSS and optional preprocessors (Sass, Less, Stylus).
 * Supports CSS injection into the DOM or extraction to separate files.
 */
export function postcss(pluginOptions: PostCSSPluginOptions = {}): Plugin {
  const options: NormalizedPostCSSOptions = normalizeOptions(pluginOptions);

  // Create file filter
  const defaultExtensions = [
    '.css',
    '.sss',
    '.pcss', // CSS formats
    '.scss',
    '.sass', // Sass
    '.less', // Less
    '.styl',
    '.stylus', // Stylus
  ];

  const extensions = options.extensions ?? defaultExtensions;

  const filter = createFilter(
    options.include ?? extensions.map((ext) => `**/*${ext}`),
    options.exclude ?? /node_modules/
  );

  // Initialize the loaders
  const loaders = new Loaders({
    postcss: {
      plugins: options.plugins,
      modules: options.modules,
      autoModules: options.autoModules,
      extract: options.extract,
      inject: options.inject,
    },
    use: options.use,
  });

  // Storage for extracted CSS (when extract is enabled)
  const extracted = new Map<string, ExtractedCSS>();

  // Track module dependencies for correct CSS ordering
  const moduleGraph = new Map<string, Set<string>>();

  return {
    name: 'postcss',

    /**
     * Resolve the virtual style-inject module
     */
    resolveId(source: string) {
      if (source === STYLE_INJECT_PATH) {
        return STYLE_INJECT_ID;
      }
      return null;
    },

    /**
     * Load the virtual style-inject module
     */
    load(id: string) {
      if (id === STYLE_INJECT_ID) {
        return styleInjectCode;
      }
      return null;
    },

    /**
     * Transform CSS files
     */
    async transform(this: PluginContext, code: string, id: string) {
      // Skip non-CSS files
      if (!filter(id)) {
        return null;
      }

      const ext = extname(id);
      if (!extensions.includes(ext)) {
        return null;
      }

      // Track dependencies for this module
      const deps = new Set<string>();
      moduleGraph.set(id, deps);

      // Process through the loader chain
      const result = await loaders.process(code, {
        id,
        sourceMap: options.sourceMap,
        dependencies: deps,
        warn: (message: string) => this.warn(message),
      });

      // Add watch dependencies
      for (const dep of deps) {
        this.addWatchFile(dep);
      }

      // Store extracted CSS if in extract mode
      if (result.extracted) {
        extracted.set(id, {
          id,
          code: result.extracted.code,
          map: result.extracted.map,
        });
      }

      return {
        code: result.code,
        map: toRollupSourceMap(result.map) ?? { mappings: '' },
      };
    },

    /**
     * Include extracted CSS in chunk hash
     */
    augmentChunkHash(chunk) {
      if (!options.extract || extracted.size === 0) {
        return;
      }

      // Find CSS files that belong to this chunk
      const chunkCSS: string[] = [];
      for (const moduleId of Object.keys(chunk.modules)) {
        const css = extracted.get(moduleId);
        if (css) {
          chunkCSS.push(css.code);
        }
      }

      if (chunkCSS.length > 0) {
        return chunkCSS.join(':');
      }
    },

    /**
     * Generate the extracted CSS files
     */
    async generateBundle(this: PluginContext, outputOptions, bundle) {
      if (!options.extract || extracted.size === 0) {
        return;
      }

      // Group extracted CSS by chunk
      const cssPerChunk = new Map<string, ExtractedCSS[]>();

      for (const [chunkId, chunk] of Object.entries(bundle)) {
        if (chunk.type !== 'chunk') {
          continue;
        }

        const chunkModules = Object.keys(chunk.modules);
        const cssForChunk: ExtractedCSS[] = [];

        // Get the import order for CSS files in this chunk
        const orderedModules: string[] = [];
        for (const moduleId of chunkModules) {
          orderedModules.push(
            ...getRecursiveImportOrder(moduleId, moduleGraph)
          );
        }

        // Remove duplicates while preserving order
        const seen = new Set<string>();
        const uniqueModules = orderedModules.filter((id) => {
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });

        // Collect CSS in dependency order
        for (const moduleId of uniqueModules) {
          const css = extracted.get(moduleId);
          if (css) {
            cssForChunk.push(css);
          }
        }

        if (cssForChunk.length > 0) {
          cssPerChunk.set(chunkId, cssForChunk);
        }
      }

      // Emit CSS files for each chunk
      for (const [chunkId, cssFiles] of cssPerChunk) {
        const chunk = bundle[chunkId];
        if (chunk.type !== 'chunk') continue;

        // Use the actual chunk filename to derive CSS filename
        // This preserves patterns like index.esm.js -> index.esm.css
        const chunkFileName = chunk.fileName;
        const chunkBaseName = basename(chunkFileName, extname(chunkFileName));
        const cssFilename = getExtractedFilename(
          options.extract,
          chunkBaseName
        );

        // Concatenate CSS files with source maps
        const concat = new Concat(!!options.sourceMap, cssFilename, '\n');

        for (const css of cssFiles) {
          const relativePath = relative(process.cwd(), css.id);
          concat.add(
            relativePath,
            css.code,
            css.map ? JSON.stringify(css.map) : undefined
          );
        }

        // Emit the CSS file
        const cssContent = concat.content.toString();
        const cssMap = concat.sourceMap;

        // Determine if source map should be inline or separate
        let finalCSS = cssContent;
        if (options.sourceMap === 'inline' && cssMap) {
          const mapBase64 = Buffer.from(cssMap).toString('base64');
          finalCSS += `\n/*# sourceMappingURL=data:application/json;base64,${mapBase64} */`;
        } else if (options.sourceMap && cssMap) {
          // Add source map reference
          finalCSS += `\n/*# sourceMappingURL=${cssFilename}.map */`;

          // Emit source map file
          this.emitFile({
            type: 'asset',
            fileName: `${cssFilename}.map`,
            source: cssMap,
          });
        }

        // Emit CSS file
        this.emitFile({
          type: 'asset',
          fileName: cssFilename,
          source: finalCSS,
        });
      }
    },
  };
}
