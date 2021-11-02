import {
  AssetGlob,
  FileInputOutput,
} from '@nrwl/workspace/src/utilities/assets';
import { TsPluginEntry } from '../../../utils/types';

export interface NodePackageBuilderOptions {
  main: string;
  tsConfig: string;
  outputPath: string;
  watch: boolean;
  sourceMap: boolean;
  assets: Array<AssetGlob | string>;
  packageJson: string;
  updateBuildableProjectDepsInPackageJson?: boolean;
  buildableProjectDepsInPackageJsonType?: 'dependencies' | 'peerDependencies';
  srcRootForCompilationRoot?: string;
  deleteOutputPath: boolean;
  cli?: boolean;
  tsPlugins?: TsPluginEntry[];
}

export interface NormalizedBuilderOptions extends NodePackageBuilderOptions {
  files: Array<FileInputOutput>;
  normalizedOutputPath: string;
  relativeMainFileOutput: string;
}
