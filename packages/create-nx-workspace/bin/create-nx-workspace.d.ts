import * as yargs from 'yargs';
import { CreateWorkspaceOptions } from '../src/create-workspace-options.js';
import { Preset } from '../src/utils/preset/preset.js';
interface BaseArguments extends CreateWorkspaceOptions {
  preset: Preset;
  linter?: 'none' | 'eslint';
  formatter?: 'none' | 'prettier';
  workspaces?: boolean;
  useProjectJson?: boolean;
}
interface NoneArguments extends BaseArguments {
  stack: 'none';
  workspaceType?: 'package-based' | 'integrated' | 'standalone';
  js?: boolean;
  appName?: string | undefined;
}
interface ReactArguments extends BaseArguments {
  stack: 'react';
  workspaceType: 'standalone' | 'integrated';
  appName: string;
  framework: 'none' | 'next';
  style: string;
  bundler: 'webpack' | 'vite' | 'rspack';
  nextAppDir: boolean;
  nextSrcDir: boolean;
  useReactRouter: boolean;
  routing: boolean;
  unitTestRunner: 'none' | 'jest' | 'vitest';
  e2eTestRunner: 'none' | 'cypress' | 'playwright';
}
interface AngularArguments extends BaseArguments {
  stack: 'angular';
  workspaceType: 'standalone' | 'integrated';
  appName: string;
  style: string;
  routing: boolean;
  standaloneApi: boolean;
  unitTestRunner: 'none' | 'jest' | 'vitest';
  e2eTestRunner: 'none' | 'cypress' | 'playwright';
  bundler: 'webpack' | 'rspack' | 'esbuild';
  ssr: boolean;
  prefix: string;
}
interface VueArguments extends BaseArguments {
  stack: 'vue';
  workspaceType: 'standalone' | 'integrated';
  appName: string;
  framework: 'none' | 'nuxt';
  style: string;
  unitTestRunner: 'none' | 'vitest';
  e2eTestRunner: 'none' | 'cypress' | 'playwright';
}
interface NodeArguments extends BaseArguments {
  stack: 'node';
  workspaceType: 'standalone' | 'integrated';
  appName: string;
  framework: 'none' | 'express' | 'fastify' | 'koa' | 'nest';
  docker: boolean;
  unitTestRunner: 'none' | 'jest';
}
interface UnknownStackArguments extends BaseArguments {
  stack: 'unknown';
}
type Arguments =
  | NoneArguments
  | ReactArguments
  | AngularArguments
  | VueArguments
  | NodeArguments
  | UnknownStackArguments;
export declare const commandsObject: yargs.Argv<Arguments>;
export declare function validateWorkspaceName(name: string): void;
export {};
//# sourceMappingURL=create-nx-workspace.d.ts.map
