import type { Tree } from '@nrwl/devkit';
import {
  formatFiles,
  normalizePath,
  readProjectConfiguration,
  readWorkspaceConfiguration,
} from '@nrwl/devkit';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';
import { pathStartsWith } from '../utils/path';
import { exportComponentInEntryPoint } from './lib/component';
import { normalizeOptions } from './lib/normalize-options';
import type { NormalizedSchema, Schema } from './schema';

export async function componentGenerator(tree: Tree, rawOptions: Schema) {
  const options = normalizeOptions(tree, rawOptions);
  const { projectSourceRoot, ...schematicOptions } = options;

  checkPathUnderProjectRoot(tree, options);

  const angularComponentSchematic = wrapAngularDevkitSchematic(
    '@schematics/angular',
    'component'
  );
  await angularComponentSchematic(tree, schematicOptions);

  exportComponentInEntryPoint(tree, options);

  await formatFiles(tree);
}

function checkPathUnderProjectRoot(tree: Tree, schema: NormalizedSchema): void {
  if (!schema.path) {
    return;
  }

  const project =
    schema.project ?? readWorkspaceConfiguration(tree).defaultProject;
  const { root } = readProjectConfiguration(tree, project);

  let pathToComponent = normalizePath(schema.path);
  pathToComponent = pathToComponent.startsWith('/')
    ? pathToComponent.slice(1)
    : pathToComponent;

  if (!pathStartsWith(pathToComponent, root)) {
    throw new Error(
      `The path provided for the component (${schema.path}) does not exist under the project root (${root}). ` +
        `Please make sure to provide a path that exists under the project root.`
    );
  }
}

export default componentGenerator;
