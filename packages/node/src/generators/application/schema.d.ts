import type { LinterType } from '@nx/js';

export interface Schema {
  directory: string;
  name?: string;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  unitTestRunner?: 'jest' | 'vitest' | 'none';
  e2eTestRunner?: 'jest' | 'vitest' | 'none';
  linter?: LinterType;
  formatter?: 'none' | 'prettier' | 'oxfmt';
  tags?: string;
  frontendProject?: string;
  swcJest?: boolean;
  /** @deprecated use `swcJest` instead */
  babelJest?: boolean;
  js?: boolean;
  enableTypedLinting?: boolean;
  bundler?: 'tsc' | 'rolldown' | 'esbuild' | 'webpack';
  framework?: NodeJsFrameWorks;
  port?: number;
  rootProject?: boolean;
  docker?: boolean;
  skipDockerPlugin?: boolean;
  isNest?: boolean;
  useTsSolution?: boolean;
  useProjectJson?: boolean;
  keepExistingVersions?: boolean;
}

export type NodeJsFrameWorks = 'express' | 'koa' | 'fastify' | 'nest' | 'none';
