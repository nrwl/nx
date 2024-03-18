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
    const files = new Set(json.files ?? []);
    files.add(joinPathFragments('src', options.main));
    files.add(joinPathFragments(options.serverFileName));
    json.files = Array.from(files);

    json.compilerOptions ??= {};
    const types = new Set(json.compilerOptions.types ?? []);
    types.add('node');
    json.compilerOptions.types = Array.from(types);

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
