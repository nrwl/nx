import { ProjectNameAndRootFormat } from '@nx/devkit/src/generators/project-name-and-root-utils';

export interface Schema {
  projectName: string;
  destination: string;
  importPath?: string;
  updateImportPath: boolean;
  skipFormat?: boolean;
  newProjectName?: string;
  projectNameAndRootFormat?: ProjectNameAndRootFormat;
}

export interface NormalizedSchema extends Schema {
  relativeToRootDestination: string;
}
