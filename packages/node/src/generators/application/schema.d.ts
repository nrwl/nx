import { Linter } from '@nx/linter';

export interface Schema {
  name: string;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  directory?: string;
  unitTestRunner?: 'jest' | 'none';
  e2eTestRunner?: 'jest' | 'none';
  linter?: Linter;
  tags?: string;
  frontendProject?: string;
  swcJest?: boolean;
  /** @deprecated use `swcJest` instead */
  babelJest?: boolean;
  js?: boolean;
  pascalCaseFiles?: boolean;
  setParserOptionsProject?: boolean;
  standaloneConfig?: boolean;
  bundler?: 'esbuild' | 'webpack';
  framework?: NodeJsFrameWorks;
  port?: number;
  rootProject?: boolean;
  docker?: boolean;
  isNest?: boolean;
}

export type NodeJsFrameWorks = 'express' | 'koa' | 'fastify' | 'nest' | 'none';
