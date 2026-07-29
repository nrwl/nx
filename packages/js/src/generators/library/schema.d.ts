import type { ProjectNameAndRootOptions } from '@nx/devkit/internal';
import type { LinterType } from '../../utils/linter';
import type { ProjectPackageManagerWorkspaceState } from '../../utils/package-manager-workspaces';

export type Compiler = 'tsc' | 'swc';
export type Bundler = 'swc' | 'tsc' | 'rollup' | 'vite' | 'esbuild' | 'none';

export interface LibraryGeneratorSchema {
  directory: string;
  name?: string;
  skipFormat?: boolean;
  tags?: string;
  skipTsConfig?: boolean;
  skipPackageJson?: boolean;
  includeBabelRc?: boolean;
  unitTestRunner?: 'jest' | 'vitest' | 'none';
  linter?: LinterType;
  formatter?: 'none' | 'prettier' | 'oxfmt';
  testEnvironment?: 'jsdom' | 'node';
  importPath?: string;
  js?: boolean;
  pascalCaseFiles?: boolean;
  strict?: boolean;
  publishable?: boolean;
  buildable?: boolean;
  enableTypedLinting?: boolean;
  /**
   * @deprecated Use `enableTypedLinting` instead. This option will be removed in Nx v24.
   */
  setParserOptionsProject?: boolean;
  config?: 'workspace' | 'project' | 'npm-scripts';
  compiler?: Compiler;
  bundler?: Bundler;
  skipTypeCheck?: boolean;
  minimal?: boolean;
  rootProject?: boolean;
  addPlugin?: boolean;
  useProjectJson?: boolean;
  useTscExecutor?: boolean;
  /** @internal Only honored by the vitest setup. */
  passWithNoTests?: boolean;
}

export interface NormalizedLibraryGeneratorOptions
  extends LibraryGeneratorSchema {
  name: string;
  /** `normalizeOptions` always resolves this, so it is no longer optional. */
  linter: LinterType;
  projectNames: ProjectNameAndRootOptions['names'];
  fileName: string;
  projectRoot: string;
  parsedTags: string[];
  importPath?: string;
  hasPlugin: boolean;
  isUsingTsSolutionConfig: boolean;
  shouldUseSwcJest: boolean;
}
