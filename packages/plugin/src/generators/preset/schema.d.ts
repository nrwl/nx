export interface PresetGeneratorSchema {
  pluginName: string;
  createPackageName?: string;
  useProjectJson?: boolean;
  addPlugin?: boolean;
}

export interface NormalizedPresetGeneratorOptions
  extends PresetGeneratorSchema {
  createPackageName: string;
  useProjectJson: boolean;
  addPlugin: boolean;
}
