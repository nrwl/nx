import { Preset } from '../utils/presets';
import { PackageManager } from '@nrwl/devkit';

export interface Schema {
  name: string;
  npmScope?: string;
  style?: string;
  linter?: string;
  preset: Preset;
  standaloneConfig?: boolean;
  framework?: string;
  packageManager?: PackageManager;
  bundler?: 'vite' | 'webpack';
  docker?: boolean;
  routing?: boolean;
  standaloneApi?: boolean;
}
