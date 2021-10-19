import { HashFormat } from '../../hash-format';

type Compiler = any;

export interface RemoveHashPluginOptions {
  chunkNames: string[];
  hashFormat: HashFormat;
}

export class RemoveHashPlugin {
  constructor(private options: RemoveHashPluginOptions) {}

  apply(compiler: Compiler): void {
    compiler.hooks.compilation.tap('remove-hash-plugin', (compilation) => {
      // MainTemplate is slated to be removed in Webpack 6
      compilation.mainTemplate.hooks.assetPath.tap(
        'remove-hash-plugin',
        (path: string, data: { chunk?: { name: string } }) => {
          const chunkName = data.chunk && data.chunk.name;
          const { chunkNames, hashFormat } = this.options;

          if (chunkName && chunkNames.includes(chunkName)) {
            // Replace hash formats with empty strings.
            return path
              .replace(hashFormat.chunk, '')
              .replace(hashFormat.extract, '');
          }

          return path;
        }
      );
    });
  }
}
