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
      const foundReplace = replacements.find((replacement)=>{
        return id.endsWith(replacement.replace)
      });
      if (foundReplace) {
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
