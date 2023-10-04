export interface SetupBuildGeneratorSchema {
  project: string;
  bundler: 'tsc' | 'swc' | 'vite' | 'rollup' | 'esbuild';
  main?: string;
  tsConfig?: string;
  buildTarget?: string;
}
