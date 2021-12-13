import type { Tree } from '@nrwl/devkit';
import type { Schema } from './schema';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';
import {
  formatFiles,
  readWorkspaceConfiguration,
  readProjectConfiguration,
  normalizePath,
} from '@nrwl/devkit';
import { createScamDirective } from './lib/create-module';
import { normalize } from 'path';

export async function scamDirectiveGenerator(tree: Tree, schema: Schema) {
  const { inlineScam, ...options } = schema;

  checkPathUnderProjectRoot(tree, options);

  const angularDirectiveSchematic = wrapAngularDevkitSchematic(
    '@schematics/angular',
    'directive'
  );
  await angularDirectiveSchematic(tree, {
    ...options,
    skipImport: true,
    export: false,
  });

  createScamDirective(tree, schema);

  await formatFiles(tree);
}

function checkPathUnderProjectRoot(tree: Tree, options: Partial<Schema>) {
  if (!options.path) {
    return;
  }

  const project =
    options.project ?? readWorkspaceConfiguration(tree).defaultProject;
  const { root } = readProjectConfiguration(tree, project);

  let pathToDirective = normalizePath(options.path);
  pathToDirective = pathToDirective.startsWith('/')
    ? pathToDirective.slice(1)
    : pathToDirective;

  if (!pathToDirective.startsWith(normalize(root))) {
    throw new Error(
      `The path provided for the SCAM (${options.path}) does not exist under the project root (${root}).`
    );
  }
}

export default scamDirectiveGenerator;
