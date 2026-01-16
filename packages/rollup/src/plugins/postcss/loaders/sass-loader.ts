import { dirname, resolve, basename, join } from 'path';
import type {
  Loader,
  LoaderContext,
  LoaderResult,
  SassLoaderOptions,
} from './types';
import { loadModule, humanizePath } from '../utils';

interface SassOptions {
  file?: string;
  data?: string;
  includePaths?: string[];
  sourceMap?: boolean;
  outFile?: string;
  sourceMapContents?: boolean;
  importer?: SassImporter | SassImporter[];
  [key: string]: unknown;
}

interface SassResult {
  css: Buffer;
  map?: Buffer;
  stats: {
    includedFiles: string[];
  };
}

type SassImporter = (
  url: string,
  prev: string,
  done: (result: { file: string } | { contents: string } | Error | null) => void
) => void | { file: string } | { contents: string } | Error | null;

interface SassStatic {
  render(
    options: SassOptions,
    callback: (error: Error | null, result: SassResult) => void
  ): void;
  renderSync(options: SassOptions): SassResult;
}

interface ModernSassStatic {
  compile(path: string, options?: ModernSassOptions): ModernSassResult;
  compileString(source: string, options?: ModernSassOptions): ModernSassResult;
}

interface ModernSassOptions {
  loadPaths?: string[];
  sourceMap?: boolean;
  importers?: ModernSassImporter[];
  [key: string]: unknown;
}

interface ModernSassImporter {
  findFileUrl?(
    url: string,
    context: { containingUrl: URL | null }
  ): URL | null | Promise<URL | null>;
}

interface ModernSassResult {
  css: string;
  sourceMap?: {
    sources: string[];
    [key: string]: unknown;
  };
  loadedUrls: URL[];
}

let sassModule: SassStatic | ModernSassStatic | undefined;
let isModernSass = false;

/**
 * Get the sass module, trying modern sass first, then node-sass
 */
function getSassModule(): SassStatic | ModernSassStatic {
  if (sassModule) {
    return sassModule;
  }

  // Try modern sass first
  const modernSass = loadModule<ModernSassStatic>('sass');
  if (modernSass && typeof modernSass.compile === 'function') {
    sassModule = modernSass;
    isModernSass = true;
    return sassModule;
  }

  // Try legacy sass (or node-sass)
  const legacySass =
    loadModule<SassStatic>('sass') || loadModule<SassStatic>('node-sass');
  if (legacySass && typeof legacySass.render === 'function') {
    sassModule = legacySass;
    isModernSass = false;
    return sassModule;
  }

  throw new Error(
    'You need to install "sass" or "node-sass" package in order to process Sass files.'
  );
}

/**
 * Resolve a module import (handles ~ prefix for node_modules)
 */
function resolveModuleImport(url: string, prev: string): string | null {
  if (!url.startsWith('~')) {
    return null;
  }

  const modulePath = url.slice(1);
  const prevDir = dirname(prev);

  // Try to resolve from node_modules
  const paths = [
    join(prevDir, 'node_modules', modulePath),
    join(process.cwd(), 'node_modules', modulePath),
  ];

  // Also try partial file (with underscore prefix)
  const dir = dirname(modulePath);
  const file = basename(modulePath);
  const partialPaths = [
    join(prevDir, 'node_modules', dir, `_${file}`),
    join(process.cwd(), 'node_modules', dir, `_${file}`),
  ];

  // Try all paths with various extensions
  const extensions = ['', '.scss', '.sass', '.css'];

  for (const basePath of [...partialPaths, ...paths]) {
    for (const ext of extensions) {
      const fullPath = basePath + ext;
      try {
        require.resolve(fullPath);
        return fullPath;
      } catch {
        // Continue trying
      }
    }
  }

  return null;
}

/**
 * Sass/SCSS preprocessor loader
 * Compiles .sass and .scss files to CSS
 */
export function createSassLoader(options: SassLoaderOptions = {}): Loader {
  return {
    name: 'sass',
    test: /\.(sass|scss)$/,

    async process(code: string, context: LoaderContext): Promise<LoaderResult> {
      const sass = getSassModule();
      const { implementation: _, ...sassOptions } = options;

      if (isModernSass) {
        // Modern sass (Dart Sass) with compile API
        const modernSass = sass as ModernSassStatic;

        const result = modernSass.compileString(code, {
          ...sassOptions,
          loadPaths: [dirname(context.id), process.cwd(), 'node_modules'],
          sourceMap: !!context.sourceMap,
          importers: [
            {
              findFileUrl(url: string) {
                const resolved = resolveModuleImport(url, context.id);
                if (resolved) {
                  return new URL(`file://${resolve(resolved)}`);
                }
                return null;
              },
            },
          ],
        });

        // Track dependencies
        for (const loadedUrl of result.loadedUrls) {
          if (loadedUrl.protocol === 'file:') {
            context.dependencies.add(loadedUrl.pathname);
          }
        }

        let map: LoaderResult['map'];
        if (result.sourceMap) {
          map = result.sourceMap as unknown as LoaderResult['map'];
          if (map?.sources) {
            map.sources = map.sources.map(humanizePath);
          }
        }

        return {
          code: result.css,
          map,
        };
      } else {
        // Legacy sass/node-sass with render API
        const legacySass = sass as SassStatic;

        return new Promise((resolvePromise, reject) => {
          legacySass.render(
            {
              ...sassOptions,
              data: code,
              file: context.id,
              includePaths: [dirname(context.id), process.cwd()],
              sourceMap: !!context.sourceMap,
              outFile: context.id,
              sourceMapContents: true,
              importer: (url, prev, done) => {
                const resolved = resolveModuleImport(url, prev);
                if (resolved) {
                  done({ file: resolved });
                } else {
                  done(null);
                }
              },
            },
            (error, result) => {
              if (error) {
                reject(error);
                return;
              }

              // Track dependencies
              if (result.stats.includedFiles) {
                for (const dep of result.stats.includedFiles) {
                  context.dependencies.add(dep);
                }
              }

              let map: LoaderResult['map'];
              if (result.map) {
                map = JSON.parse(result.map.toString());
                if (map?.sources) {
                  map.sources = map.sources.map(humanizePath);
                }
              }

              resolvePromise({
                code: result.css.toString(),
                map,
              });
            }
          );
        });
      }
    },
  };
}
