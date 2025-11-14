/**
 * @function replaceFiles
 * @param {FileReplacement[]} replacements
 * @return {({name: "rollup-plugin-replace-files", enforce: "pre" | "post" | undefined, Promise<resolveId>})}
 */
export declare function replaceFiles(replacements: FileReplacement[]): {
  name: string;
  enforce: 'pre' | 'post' | undefined;
  resolveId(
    source: any,
    importer: any,
    options: any
  ): Promise<{
    id: string;
  }>;
};
export interface FileReplacement {
  replace: string;
  with: string;
}
//# sourceMappingURL=rollup-replace-files.plugin.d.ts.map
