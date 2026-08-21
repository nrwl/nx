import { AssetGlob } from '@nx/js/internal';
import * as esbuild from 'esbuild';

type Compiler = 'babel' | 'swc';

export interface EsBuildExecutorOptions {
  additionalEntryPoints?: string[];
  assets?: (AssetGlob | string)[];
  bundle?: boolean;
  declaration?: boolean;
  declarationRootDir?: string;
  /**
   * Use oxc-transform for generating TypeScript declaration files (.d.ts)
   * instead of the TypeScript compiler. Requires `isolatedDeclarations: true`
   * in the project's tsconfig.
   */
  useOxcDeclarations?: boolean;
  deleteOutputPath?: boolean;
  esbuildOptions?: Record<string, any>;
  esbuildConfig?: string;
  external?: string[];
  excludeFromExternal?: string[];
  format?: Array<'esm' | 'cjs'>;
  generatePackageJson?: boolean;
  main: string;
  metafile?: boolean;
  minify?: boolean;
  outputFileName?: string;
  outputHashing?: 'none' | 'all';
  outputPath: string;
  platform?: 'node' | 'browser' | 'neutral';
  sourcemap?: boolean | 'linked' | 'inline' | 'external' | 'both';
  skipTypeCheck?: boolean;
  target?: string;
  thirdParty?: boolean;
  tsConfig: string;
  watch?: boolean;
}

export interface NormalizedEsBuildExecutorOptions
  extends Omit<EsBuildExecutorOptions, 'esbuildOptions' | 'esbuildConfig'> {
  assets: (AssetGlob | string)[];
  singleEntry: boolean;
  external: string[];
  excludeFromExternal: string[];
  userDefinedBuildOptions: esbuild.BuildOptions | undefined;
  isTsSolutionSetup?: boolean;
}
