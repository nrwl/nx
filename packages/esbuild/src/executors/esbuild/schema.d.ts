import { AssetGlob } from '@nrwl/workspace/src/utilities/assets';

type Compiler = 'babel' | 'swc';

export interface EsBuildExecutorOptions {
  additionalEntryPoints?: string[];
  assets: (AssetGlob | string)[];
  buildableProjectDepsInPackageJsonType?: 'dependencies' | 'peerDependencies';
  bundle?: boolean;
  deleteOutputPath?: boolean;
  dependenciesFieldType?: boolean;
  esbuildOptions?: Record<string, any>;
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
  extends EsBuildExecutorOptions {
  singleEntry: boolean;
  external: string[];
}
