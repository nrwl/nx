import { Preset } from '../utils/presets';
import { PackageManager } from '@nx/devkit';

export interface Schema {
  name: string;
  preset: Preset;
  style?: string;
  linter?: string;
  formatter?: 'none' | 'prettier';
  workspaces?: boolean;
  standaloneConfig?: boolean;
  framework?: string;
  packageManager?: PackageManager;
  bundler?: 'vite' | 'rsbuild' | 'webpack' | 'rspack' | 'esbuild';
  docker?: boolean;
  nextAppDir?: boolean;
  nextSrcDir?: boolean;
  routing?: boolean;
  useReactRouter?: boolean;
  standaloneApi?: boolean;
  unitTestRunner?: 'jest' | 'vitest' | 'none';
  e2eTestRunner?: 'cypress' | 'playwright' | 'jest' | 'detox' | 'none';
  js?: boolean;
  ssr?: boolean;
  serverRouting?: boolean;
  prefix?: string;
  nxCloudToken?: string;
  useProjectJson?: boolean;
}
