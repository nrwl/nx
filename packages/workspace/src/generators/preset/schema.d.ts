import { Preset } from '../utils/presets';
import { PackageManager } from '@nx/devkit';

export interface Schema {
  name: string;
  preset: Preset;
  style?: string;
  linter?: string;
  standaloneConfig?: boolean;
  framework?: string;
  packageManager?: PackageManager;
  bundler?: 'vite' | 'webpack' | 'rspack' | 'esbuild';
  docker?: boolean;
  nextAppDir?: boolean;
  nextSrcDir?: boolean;
  routing?: boolean;
  standaloneApi?: boolean;
  e2eTestRunner?: 'cypress' | 'playwright' | 'jest' | 'detox' | 'none';
  js?: boolean;
  ssr?: boolean;
  prefix?: string;
}
