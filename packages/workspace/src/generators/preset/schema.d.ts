// nx-ignore-next-line
import type { Linter } from '@nrwl/linter';

import { Preset } from '../utils/presets';
import { PackageManager } from '@nrwl/devkit';

export interface Schema {
  name: string;
  npmScope?: string;
  style?: string;
  cli: string;
  linter?: Linter;
  preset: Preset;
  standaloneConfig?: boolean;
  packageManager?: PackageManager;
}
