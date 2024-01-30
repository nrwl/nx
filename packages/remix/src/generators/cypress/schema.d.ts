import { type ProjectNameAndRootFormat } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { Linter } from '@nx/eslint';

export interface CypressGeneratorSchema {
  project: string;
  name: string;
  baseUrl?: string;
  directory?: string;
  projectNameAndRootFormat?: ProjectNameAndRootFormat;
  linter?: Linter;
  js?: boolean;
  skipFormat?: boolean;
  setParserOptionsProject?: boolean;
}
