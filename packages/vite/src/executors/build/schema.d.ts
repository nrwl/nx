export interface ViteBuildExecutorOptions {
  buildLibsFromSource?: boolean;
  configFile?: string;
  /**
   * How to generate TypeScript declaration files (.d.ts) during the build.
   * - `'tsc'` — uses the TypeScript compiler (via vite-plugin-dts)
   * - `'oxc'` — uses oxc-transform's `isolatedDeclaration` (requires `isolatedDeclarations: true` in tsconfig)
   * - `'rolldown-plugin-dts'` — uses Rolldown-native DTS bundling
   * - `'none'` — skips declaration generation
   */
  declarations?: 'tsc' | 'oxc' | 'rolldown-plugin-dts' | 'none';
  generatePackageJson?: boolean;
  includeDevDependenciesInPackageJson?: boolean;
  outputPath?: string;
  skipOverrides?: boolean;
  skipPackageManager?: boolean;
  skipTypeCheck?: boolean;
  tsConfig?: string;
  watch?: boolean;
  useEnvironmentsApi?: boolean;
}
