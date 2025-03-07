import { RsbuildConfig } from '@rsbuild/core';
import * as compilerCli from '@angular/compiler-cli';
import * as ts from 'typescript';
import { PluginAngularOptions } from '../models';
export declare function setupCompilation(
  config: RsbuildConfig,
  options: PluginAngularOptions
): {
  rootNames: string[];
  compilerOptions: compilerCli.CompilerOptions;
  host: ts.CompilerHost;
};
