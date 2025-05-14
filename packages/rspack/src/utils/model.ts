export interface ExtraEntryPointClass {
  bundleName?: string;
  inject?: boolean;
  input: string;
  lazy?: boolean;
}

export type ExtraEntryPoint = ExtraEntryPointClass | string;

export type NormalizedEntryPoint = Required<ExtraEntryPointClass>;

export interface EmittedFile {
  id?: string;
  name?: string;
  file: string;
  extension: string;
  initial: boolean;
  asset?: boolean;
}
