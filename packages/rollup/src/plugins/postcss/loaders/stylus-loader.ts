import { dirname } from 'path';
import type {
  Loader,
  LoaderContext,
  LoaderResult,
  StylusLoaderOptions,
} from './types';
import { requireModule, humanizePath } from '../utils';

interface StylusStatic {
  (code: string): StylusRenderer;
}

interface StylusRenderer {
  set(key: string, value: unknown): this;
  render(callback: (error: Error | null, css: string) => void): void;
  deps(): string[];
  sourcemap:
    | {
        sources: string[];
        [key: string]: unknown;
      }
    | undefined;
}

let stylus: StylusStatic | undefined;

/**
 * Stylus preprocessor loader
 * Compiles .styl and .stylus files to CSS
 */
export function createStylusLoader(options: StylusLoaderOptions = {}): Loader {
  return {
    name: 'stylus',
    test: /\.(styl|stylus)$/,

    async process(code: string, context: LoaderContext): Promise<LoaderResult> {
      if (!stylus) {
        stylus = requireModule<StylusStatic>('stylus', 'Stylus');
      }

      const renderer = stylus(code);

      // Set options
      renderer.set('filename', context.id);
      renderer.set('paths', [dirname(context.id), process.cwd()]);

      if (context.sourceMap) {
        renderer.set('sourcemap', {
          comment: false,
          inline: false,
          basePath: process.cwd(),
        });
      }

      // Apply additional options
      for (const [key, value] of Object.entries(options)) {
        renderer.set(key, value);
      }

      return new Promise((resolve, reject) => {
        renderer.render((error, css) => {
          if (error) {
            reject(error);
            return;
          }

          // Track dependencies
          const deps = renderer.deps();
          for (const dep of deps) {
            context.dependencies.add(dep);
          }

          let map: LoaderResult['map'];
          if (renderer.sourcemap) {
            map = renderer.sourcemap as unknown as LoaderResult['map'];
            if (map?.sources) {
              map.sources = map.sources.map(humanizePath);
            }
          }

          resolve({
            code: css,
            map,
          });
        });
      });
    },
  };
}
