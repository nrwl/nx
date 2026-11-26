export interface ExtraEntryPointClass {
  bundleName?: string;
  inject?: boolean;
  input: string;
  lazy?: boolean;
}

export type ExtraEntryPoint = ExtraEntryPointClass | string;

export type NormalizedEntryPoint = ExtraEntryPointClass & {
  bundleName: string;
};

export interface EmittedFile {
  id?: string;
  name?: string;
  file: string;
  extension: string;
  initial: boolean;
  asset?: boolean;
}
