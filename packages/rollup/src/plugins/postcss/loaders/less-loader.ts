import { promisify } from 'util';
import type {
  Loader,
  LoaderContext,
  LoaderResult,
  LessLoaderOptions,
} from './types';
import { requireModule, humanizePath } from '../utils';

interface LessStatic {
  render(
    input: string,
    options: LessRenderOptions,
    callback: (
      error: Less.RenderError | null,
      output: Less.RenderOutput | undefined
    ) => void
  ): void;
}

interface LessRenderOptions {
  filename?: string;
  sourceMap?: {
    outputSourceFiles?: boolean;
  };
  javascriptEnabled?: boolean;
  [key: string]: unknown;
}

declare namespace Less {
  interface RenderError {
    message: string;
    filename?: string;
    line?: number;
    column?: number;
  }

  interface RenderOutput {
    css: string;
    map?: string;
    imports: string[];
  }
}

let less: LessStatic | undefined;

/**
 * Less preprocessor loader
 * Compiles .less files to CSS
 */
export function createLessLoader(options: LessLoaderOptions = {}): Loader {
  return {
    name: 'less',
    test: /\.less$/,

    async process(code: string, context: LoaderContext): Promise<LoaderResult> {
      if (!less) {
        less = requireModule<LessStatic>('less', 'Less');
      }

      const render = promisify(less.render.bind(less));

      const result = await render(code, {
        ...options,
        filename: context.id,
        sourceMap: context.sourceMap
          ? {
              outputSourceFiles: true,
            }
          : undefined,
      });

      // Track dependencies
      if (result.imports) {
        for (const dep of result.imports) {
          context.dependencies.add(dep);
        }
      }

      let map: LoaderResult['map'];
      if (result.map) {
        map = JSON.parse(result.map);
        if (map && map.sources) {
          map.sources = map.sources.map(humanizePath);
        }
      }

      return {
        code: result.css,
        map,
      };
    },
  };
}
