import type { Tree } from '@nrwl/devkit';
import type { Schema } from './schema';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';
import {
  formatFiles,
  readWorkspaceConfiguration,
  readProjectConfiguration,
  normalizePath,
} from '@nrwl/devkit';
import { createScamPipe } from './lib/create-module';
import { normalize } from 'path';
import { pathStartsWith } from '../utils/path';

export async function scamPipeGenerator(tree: Tree, schema: Schema) {
  const { inlineScam, ...options } = schema;

  checkPathUnderProjectRoot(tree, options);

  const angularPipeSchematic = wrapAngularDevkitSchematic(
    '@schematics/angular',
    'pipe'
  );
  await angularPipeSchematic(tree, {
    ...options,
    skipImport: true,
    export: false,
  });

  createScamPipe(tree, schema);

  await formatFiles(tree);
}

function checkPathUnderProjectRoot(tree: Tree, options: Partial<Schema>) {
  if (!options.path) {
    return;
  }

  const project =
    options.project ?? readWorkspaceConfiguration(tree).defaultProject;
  const { root } = readProjectConfiguration(tree, project);

  let pathToPipe = normalizePath(options.path);
  pathToPipe = pathToPipe.startsWith('/') ? pathToPipe.slice(1) : pathToPipe;

  if (!pathStartsWith(pathToPipe, root)) {
    throw new Error(
      `The path provided for the SCAM (${options.path}) does not exist under the project root (${root}).`
    );
  }
}

export default scamPipeGenerator;
