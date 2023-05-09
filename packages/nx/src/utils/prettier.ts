import type * as Prettier from 'prettier';

let prettier: typeof Prettier | null;
export function getPrettierOrNull() {
  if (prettier === undefined) {
    try {
      prettier = require('prettier');
    } catch (e) {
      prettier = null;
    }
  }
  return prettier;
}

export function formatFileContentsWithPrettierIfAvailableSync<
  T extends string | Buffer
>(path: string, contents: T, extraOptions?: Prettier.Options): string {
  const prettier = getPrettierOrNull();
  const contentsAsString =
    typeof contents === 'string' ? contents : contents.toString('utf-8');
  if (!prettier) {
    return contentsAsString;
  }

  const resolvedOptions = prettier.resolveConfig.sync(path, {
    editorconfig: true,
  });
  const options: Prettier.Options = {
    ...resolvedOptions,
    ...extraOptions,
    filepath: path,
  };

  const support = prettier.getFileInfo.sync(path, options as any);
  if (support.ignored || !support.inferredParser) {
    return contentsAsString;
  }

  return prettier.format(contentsAsString, options);
}

export async function formatFileContentsWithPrettierIfAvailable<
  T extends string | Buffer
>(path: string, contents: T, extraOptions?: Prettier.Options): Promise<string> {
  const prettier = getPrettierOrNull();
  const contentsAsString =
    typeof contents === 'string' ? contents : contents.toString('utf-8');
  if (!prettier) {
    return contentsAsString;
  }

  const resolvedOptions = await prettier.resolveConfig(path, {
    editorconfig: true,
  });
  const options: Prettier.Options = {
    ...resolvedOptions,
    ...extraOptions,
    filepath: path,
  };

  const support = await prettier.getFileInfo(path, options as any);
  if (support.ignored || !support.inferredParser) {
    return contentsAsString;
  }

  return prettier.format(contentsAsString, options);
}
