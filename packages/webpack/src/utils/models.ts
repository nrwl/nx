export type ExtraEntryPoint = ExtraEntryPointClass | string;

export interface ExtraEntryPointClass {
  bundleName?: string;
  inject?: boolean;
  input: string;
}

export type NormalizedEntryPoint = Required<ExtraEntryPointClass>;

export interface EmittedFile {
  id?: string;
  name?: string;
  file: string;
  extension: string;
  initial: boolean;
  asset?: boolean;
}

export interface CreateWebpackConfigOptions<T = any> {
  root: string;
  projectRoot: string;
  sourceRoot?: string;
  buildOptions: T;
  tsConfig: any;
  tsConfigPath: string;
}
