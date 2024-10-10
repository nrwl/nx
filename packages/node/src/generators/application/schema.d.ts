import type { Linter, LinterType } from '@nx/eslint';

export interface Schema {
  directory: string;
  name?: string;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  unitTestRunner?: 'jest' | 'none';
  e2eTestRunner?: 'jest' | 'none';
  linter?: Linter | LinterType;
  tags?: string;
  frontendProject?: string;
  swcJest?: boolean;
  /** @deprecated use `swcJest` instead */
  babelJest?: boolean;
  js?: boolean;
  setParserOptionsProject?: boolean;
  standaloneConfig?: boolean;
  bundler?: 'esbuild' | 'webpack';
  framework?: NodeJsFrameWorks;
  port?: number;
  rootProject?: boolean;
  docker?: boolean;
  isNest?: boolean;
  addPlugin?: boolean;
}

export type NodeJsFrameWorks = 'express' | 'koa' | 'fastify' | 'nest' | 'none';
