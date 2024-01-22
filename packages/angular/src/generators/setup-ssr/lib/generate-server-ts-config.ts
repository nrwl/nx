import {
  generateFiles,
  readProjectConfiguration,
  updateJson,
  type Tree,
  joinPathFragments,
} from '@nx/devkit';
import { join } from 'path';
import type { Schema } from '../schema';

export function setServerTsConfigOptionsForApplicationBuilder(
  tree: Tree,
  options: Schema
) {
  const { targets } = readProjectConfiguration(tree, options.project);
  const tsConfigPath = targets.build.options.tsConfig;

  updateJson(tree, tsConfigPath, (json) => {
    json.files ??= [];
    json.files.push(
      joinPathFragments('src', options.main),
      joinPathFragments(options.serverFileName)
    );

    json.compilerOptions ??= {};
    json.compilerOptions.types ??= [];
    json.compilerOptions.types.push('node');

    return json;
  });
}

export function generateTsConfigServerJsonForBrowserBuilder(
  tree: Tree,
  options: Schema
) {
  const { root } = readProjectConfiguration(tree, options.project);

  generateFiles(tree, join(__dirname, '..', 'files', 'root'), root, {
    ...options,
    tpl: '',
  });
}
