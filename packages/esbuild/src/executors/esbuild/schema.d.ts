import { AssetGlob } from '@nx/js/src/utils/assets/assets';
import * as esbuild from 'esbuild';

type Compiler = 'babel' | 'swc';

export interface EsBuildExecutorOptions {
  additionalEntryPoints?: string[];
  assets: (AssetGlob | string)[];
  buildableProjectDepsInPackageJsonType?: 'dependencies' | 'peerDependencies';
  bundle?: boolean;
  deleteOutputPath?: boolean;
  dependenciesFieldType?: boolean;
  esbuildOptions?: Record<string, any>;
  esbuildConfig?: string;
  external?: string[];
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
  singleEntry: boolean;
  external: string[];
  userDefinedBuildOptions: esbuild.BuildOptions;
}
