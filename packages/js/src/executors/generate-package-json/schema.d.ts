export interface GeneratePackageJsonExecutorOptions {
  main: string;
  outputPath: string;
  /**
   * this isn't used directly in the executor but is read from "context.target.options.tsConfig" when calling copyPackageJson
   */
  tsConfig: string;
  /**
   * @default 'dependencies'
   */
  buildableProjectDepsInPackageJsonType?: 'dependencies' | 'peerDependencies';
  /**
   * @default true
   */
  excludeLibsInPackageJson?: boolean;
  /**
   * @default 'esm'
   */
  format?: 'esm' | 'cjs';
  /**
   * @default true
   */
  generateLockfile?: boolean;
}

export type NormalizedGeneratePackageJsonExecutorOptions =
  Required<GeneratePackageJsonExecutorOptions>;
