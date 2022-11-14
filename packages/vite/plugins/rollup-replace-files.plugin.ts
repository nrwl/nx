// source: https://github.com/Myrmod/vitejs-theming/blob/master/build-plugins/rollup/replace-files.js

/**
 * @function replaceFiles
 * @param {FileReplacement[]} replacements
 * @return {({name: "rollup-plugin-replace-files", enforce: "pre", Promise<resolveId>})}
 */
export default function replaceFiles(replacements: FileReplacement[]) {
  if (!replacements?.length) {
    return null;
  }
  return {
    name: 'rollup-plugin-replace-files',
    enforce: 'pre',
    async resolveId(source, importer) {
      const resolved = await this.resolve(source, importer, { skipSelf: true });
      const foundReplace = replacements.find(
        (replacement) => replacement.replace === resolved?.id
      );
      if (foundReplace) {
        console.info(
          `replace "${foundReplace.replace}" with "${foundReplace.with}"`
        );
        try {
          // return new file content
          return {
            id: foundReplace.with,
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

export interface FileReplacement {
  replace: string;
  with: string;
}
