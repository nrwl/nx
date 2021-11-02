import { ProjectConfiguration } from '@nrwl/devkit';

export interface GeneratorOptions {
  library: string;
  name: string;
  skipModule?: boolean;
}

export interface NormalizedGeneratorOptions extends GeneratorOptions {
  entryPointDestination: string;
  libraryProject: ProjectConfiguration;
  mainEntryPoint: string;
  secondaryEntryPoint: string;
  skipModule: boolean;
}
