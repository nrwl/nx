// source: https://github.com/Myrmod/vitejs-theming/blob/master/build-plugins/rollup/replace-files.js

import { resolve } from 'path';

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
    async load(id) {
      /**
       * The reason we're using endsWith here is because the resolved id
       * will be the absolute path to the file. We want to check if the
       * file ends with the file we're trying to replace, which will be essentially
       * the path from the root of our workspace.
       */
      const foundReplace = replacements.find((replacement)=>{
        return id.endsWith(replacement.replace)
      });
      if (foundReplace) {
        console.info(
          `replace "${foundReplace.replace}" with "${foundReplace.with}"`
        );
        return `export * from "${foundReplace.with}"; export { default } from "${foundReplace.with}";`;
      }
      return null
    },
  };
}

export interface FileReplacement {
  replace: string;
  with: string;
}
