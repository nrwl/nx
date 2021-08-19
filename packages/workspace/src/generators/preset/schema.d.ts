import { Preset } from '../utils/presets';

export interface Schema {
  name: string;
  npmScope?: string;
  style?: string;
  cli: string;
  linter?: string;
  preset: Preset;
  standaloneConfig?: boolean;
}
