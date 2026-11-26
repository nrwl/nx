// source: https://github.com/Myrmod/vitejs-theming/blob/master/build-plugins/rollup/replace-files.js

/**
 * @function replaceFiles
 * @param {FileReplacement[]} replacements
 * @return {({name: "rollup-plugin-replace-files", enforce: "pre" | "post" | undefined, Promise<resolveId>})}
 */
export function replaceFiles(replacements: FileReplacement[]): {
  name: string;
  enforce: 'pre' | 'post' | undefined;
  resolveId(
    this: ResolveContext,
    source: any,
    importer: any,
    options: any
  ): Promise<{
    id: string;
  } | null>;
} | null {
  if (!replacements?.length) {
    return null;
  }
  return {
    name: 'rollup-plugin-replace-files',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      const resolved = await this.resolve(source, importer, {
        ...options,
        skipSelf: true,
      });
      /**
       * The reason we're using endsWith here is because the resolved id
       * will be the absolute path to the file. We want to check if the
       * file ends with the file we're trying to replace, which will be essentially
       * the path from the root of our workspace.
       */

      const resolvedId = resolved?.id;
      const foundReplace = replacements.find((replacement) =>
        resolvedId?.endsWith(replacement.replace)
      );
      if (resolvedId && foundReplace) {
        console.info(
          `replace "${foundReplace.replace}" with "${foundReplace.with}"`
        );
        try {
          // return new file content
          return {
            id: resolvedId.replace(foundReplace.replace, foundReplace.with),
          };
        } catch (err) {
          console.error(err);
          return null;
        }
      }
      return null;
    },
  };
}

interface ResolveContext {
  resolve(
    source: string,
    importer: string | undefined,
    options: object
  ): Promise<{ id: string } | null>;
}

export interface FileReplacement {
  replace: string;
  with: string;
}
