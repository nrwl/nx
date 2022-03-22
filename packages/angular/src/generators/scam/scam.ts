import type { Tree } from '@nrwl/devkit';
import type { Schema } from './schema';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';
import {
  formatFiles,
  readWorkspaceConfiguration,
  readProjectConfiguration,
  normalizePath,
} from '@nrwl/devkit';
import { createScam } from './lib/create-module';
import { pathStartsWith } from '../utils/path';

export async function scamGenerator(tree: Tree, schema: Schema) {
  const { inlineScam, ...options } = schema;

  checkPathUnderProjectRoot(tree, options);

  const angularComponentSchematic = wrapAngularDevkitSchematic(
    '@schematics/angular',
    'component'
  );
  await angularComponentSchematic(tree, {
    ...options,
    skipImport: true,
    export: false,
  });

  createScam(tree, schema);

  await formatFiles(tree);
}

function checkPathUnderProjectRoot(tree: Tree, options: Partial<Schema>) {
  if (!options.path) {
    return;
  }

  const project =
    options.project ?? readWorkspaceConfiguration(tree).defaultProject;
  const { root } = readProjectConfiguration(tree, project);

  let pathToComponent = normalizePath(options.path);
  pathToComponent = pathToComponent.startsWith('/')
    ? pathToComponent.slice(1)
    : pathToComponent;

  if (!pathStartsWith(pathToComponent, root)) {
    throw new Error(
      `The path provided for the SCAM (${options.path}) does not exist under the project root (${root}).`
    );
  }
}

export default scamGenerator;
