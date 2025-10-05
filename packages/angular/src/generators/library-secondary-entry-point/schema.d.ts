import { ProjectConfiguration } from '@nx/devkit';

export interface GeneratorOptions {
  library: string;
  name: string;
  skipModule?: boolean;
  skipFormat?: boolean;
}

export interface NormalizedGeneratorOptions extends GeneratorOptions {
  entryPointDestination: string;
  libraryProject: ProjectConfiguration;
  mainEntryPoint: string;
  secondaryEntryPoint: string;
  skipModule: boolean;
  moduleTypeSeparator: '-' | '.';
}
