import type {
  Loader,
  LoaderContext,
  LoaderResult,
  PostCSSLoaderOptions,
  LessLoaderOptions,
  SassLoaderOptions,
  StylusLoaderOptions,
} from './types';
import { createPostCSSLoader } from './postcss-loader';
import { createLessLoader } from './less-loader';
import { createSassLoader } from './sass-loader';
import { createStylusLoader } from './stylus-loader';
import type { UseOptions } from '../options';

export * from './types';
export { createPostCSSLoader } from './postcss-loader';
export { createLessLoader } from './less-loader';
export { createSassLoader } from './sass-loader';
export { createStylusLoader } from './stylus-loader';

interface LoadersOptions {
  /** PostCSS loader options */
  postcss: PostCSSLoaderOptions;
  /** Preprocessor options */
  use: UseOptions;
}

/**
 * Manages the chain of CSS loaders (preprocessors + PostCSS)
 */
export class Loaders {
  private loaders: Loader[] = [];

  constructor(options: LoadersOptions) {
    // Register preprocessor loaders based on 'use' options
    // These are registered first and process files before PostCSS
    this.registerPreprocessors(options.use);

    // Register the PostCSS loader last - it always processes
    this.loaders.push(createPostCSSLoader(options.postcss));
  }

  /**
   * Register preprocessor loaders based on the 'use' option
   */
  private registerPreprocessors(use: UseOptions): void {
    // Less loader
    if (use.less !== false) {
      const lessOptions: LessLoaderOptions =
        typeof use.less === 'object' ? use.less : {};
      this.loaders.push(createLessLoader(lessOptions));
    }

    // Sass loader
    if (use.sass !== false) {
      const sassOptions: SassLoaderOptions =
        typeof use.sass === 'object' ? use.sass : {};
      this.loaders.push(createSassLoader(sassOptions));
    }

    // Stylus loader
    if (use.stylus !== false) {
      const stylusOptions: StylusLoaderOptions =
        typeof use.stylus === 'object' ? use.stylus : {};
      this.loaders.push(createStylusLoader(stylusOptions));
    }
  }

  /**
   * Check if any loader can process the given file
   */
  isSupported(filepath: string): boolean {
    return this.loaders.some((loader) => this.matchesLoader(loader, filepath));
  }

  /**
   * Check if a file matches a loader's test
   */
  private matchesLoader(loader: Loader, filepath: string): boolean {
    if (typeof loader.test === 'function') {
      return loader.test(filepath);
    }
    return loader.test.test(filepath);
  }

  /**
   * Process a file through the loader chain
   * Preprocessors run first (if matching), then PostCSS always runs
   */
  async process(code: string, context: LoaderContext): Promise<LoaderResult> {
    let result: LoaderResult = { code };

    // Process through each loader in order
    for (const loader of this.loaders) {
      // Skip non-matching loaders unless they always process
      if (!loader.alwaysProcess && !this.matchesLoader(loader, context.id)) {
        continue;
      }

      // Process with this loader
      const loaderResult = await loader.process(result.code, context);

      // Merge the result
      result = {
        ...result,
        ...loaderResult,
        // Preserve the map from the latest loader that produced one
        map: loaderResult.map ?? result.map,
      };
    }

    return result;
  }
}
