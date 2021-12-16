export interface GeneratorOptions {
  project: string;
  buildTarget?: string;
  skipFormat?: boolean;
  stylesEntryPoint?: string;
}

export interface NormalizedGeneratorOptions extends GeneratorOptions {
  buildTarget: string;
}
