export interface CompilerOptions {
  target: string;
  sourceMap: boolean;
  importHelpers: boolean;
  module: string;
  moduleResolution: string;
  outDir: string;
  experimentalDecorators: boolean;
  emitDecoratorMetadata: boolean;
  skipLibCheck: boolean;
  types: string[];
  lib: string[];
  declaration: boolean;
  baseUrl: string;
  rootDir: string;
  paths: Record<string, string[]>;
}

export interface TsconfigJsonConfiguration {
  compilerOptions: CompilerOptions;
}
