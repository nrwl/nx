import { ProjectNameAndRootFormat } from '@nx/devkit/src/generators/project-name-and-root-utils';

export interface Schema {
  projectName: string;
  destination: string;
  updateImportPath: boolean;
  importPath?: string;
  skipFormat?: boolean;
  newProjectName?: string;
  projectNameAndRootFormat?: ProjectNameAndRootFormat;
}
