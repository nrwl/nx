import type { LinterType } from '@nx/js';

export interface PresetGeneratorSchema {
  pluginName: string;
  createPackageName?: string;
  useProjectJson?: boolean;
  addPlugin?: boolean;
  linter?: LinterType;
}

export interface NormalizedPresetGeneratorOptions extends PresetGeneratorSchema {
  createPackageName: string;
  linter: LinterType;
}
