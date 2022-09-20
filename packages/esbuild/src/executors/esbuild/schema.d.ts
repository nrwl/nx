import { AssetGlob } from '@nrwl/workspace/src/utilities/assets';

type Compiler = 'babel' | 'swc';
export interface EsBuildExecutorOptions {
  outputPath: string;
  tsConfig: string;
  project: string;
  main: string;
  outputFileName?: string;
  assets: AssetGlob[];
  watch?: boolean;
  clean?: boolean;
  external?: string[];
  format?: Array<'esm' | 'cjs'>;
  metafile?: boolean;
  minify?: boolean;
  platform?: 'node' | 'browser' | 'neutral';
  target?: string;
  skipTypeCheck?: boolean;
  updateBuildableProjectDepsInPackageJson?: boolean;
  buildableProjectDepsInPackageJsonType?: 'dependencies' | 'peerDependencies';
}
