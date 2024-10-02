import type {
  ProjectNameAndRootFormat,
  ProjectNameAndRootOptions,
} from '@nx/devkit/src/generators/project-name-and-root-utils';
// nx-ignore-next-line
const { Linter, LinterType } = require('@nx/eslint'); // use require to import to avoid circular dependency
import type { ProjectPackageManagerWorkspaceState } from '../../utils/package-manager-workspaces';

export type Compiler = 'tsc' | 'swc';
export type Bundler = 'swc' | 'tsc' | 'rollup' | 'vite' | 'esbuild' | 'none';

export interface LibraryGeneratorSchema {
  directory: string;
  name?: string;
  projectNameAndRootFormat?: ProjectNameAndRootFormat;
  skipFormat?: boolean;
  tags?: string;
  skipTsConfig?: boolean;
  skipPackageJson?: boolean;
  includeBabelRc?: boolean;
  unitTestRunner?: 'jest' | 'vitest' | 'none';
  linter?: Linter | LinterType;
  testEnvironment?: 'jsdom' | 'node';
  importPath?: string;
  js?: boolean;
  pascalCaseFiles?: boolean;
  strict?: boolean;
  publishable?: boolean;
  buildable?: boolean;
  setParserOptionsProject?: boolean;
  config?: 'workspace' | 'project' | 'npm-scripts';
  compiler?: Compiler;
  bundler?: Bundler;
  skipTypeCheck?: boolean;
  minimal?: boolean;
  rootProject?: boolean;
  simpleName?: boolean;
  addPlugin?: boolean;
  useProjectJson?: boolean;
}

export interface NormalizedLibraryGeneratorOptions
  extends LibraryGeneratorSchema {
  name: string;
  projectNames: ProjectNameAndRootOptions['names'];
  fileName: string;
  projectRoot: string;
  parsedTags: string[];
  importPath?: string;
  hasPlugin: boolean;
  isUsingTsSolutionConfig: boolean;
  projectPackageManagerWorkspaceState: ProjectPackageManagerWorkspaceState;
}
