export interface GeneratorOptions {
  project: string;
  buildTarget?: string;
  skipFormat?: boolean;
  stylesEntryPoint?: string;
  skipPackageJson?: boolean;
}

export interface NormalizedGeneratorOptions extends GeneratorOptions {
  buildTarget: string;
}
