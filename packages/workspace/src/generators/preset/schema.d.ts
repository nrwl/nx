import { Preset } from '../utils/presets';
import { PackageManager } from '@nx/devkit';

export interface Schema {
  name: string;
  style?: string;
  linter?: string;
  preset: Preset;
  standaloneConfig?: boolean;
  framework?: string;
  packageManager?: PackageManager;
  bundler?: 'vite' | 'webpack' | 'rspack' | 'esbuild';
  docker?: boolean;
  nextAppDir?: boolean;
  routing?: boolean;
  standaloneApi?: boolean;
  e2eTestRunner?: 'cypress' | 'jest' | 'detox' | 'none';
}
