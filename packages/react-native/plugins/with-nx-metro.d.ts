type MetroConfig = any;
interface WithNxOptions {
  /**
   * Change this to true to see debugging info.
   */
  debug?: boolean;
  /**
   * A list of additional file extensions to resolve
   * All the file extensions used for imports other than 'ts', 'tsx', 'js', 'jsx', 'json'
   */
  extensions?: string[];
  /**
   * A list of additional folders to watch for changes
   * By default, it watches all the folders in the workspace root except 'dist' and 'e2e'
   */
  watchFolders?: string[];
  exportsConditionNames?: string[];
  /**
   * A list of main fields in package.json files to use for resolution
   * If a library has a package.json with a main field that can't be resolved with the default conditions, you can add the name of the field to this list.
   */
  mainFields?: string[];
}
export declare function withNxMetro(
  userConfig: MetroConfig,
  opts?: WithNxOptions
): Promise<any>;
export {};
//# sourceMappingURL=with-nx-metro.d.ts.map
