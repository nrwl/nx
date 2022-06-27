import type { Tree } from '@nrwl/devkit';
import {
  formatFiles,
  normalizePath,
  readProjectConfiguration,
  readWorkspaceConfiguration,
} from '@nrwl/devkit';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';
import { pathStartsWith } from '../utils/path';
import { convertComponentToScam, exportScam, normalizeOptions } from './lib';
import { getComponentFileInfo } from '../utils/component';
import type { Schema } from './schema';

export async function scamGenerator(tree: Tree, rawOptions: Schema) {
  const options = normalizeOptions(tree, rawOptions);
  const { inlineScam, projectSourceRoot, ...schematicOptions } = options;

  checkPathUnderProjectRoot(tree, options);

  const angularComponentSchematic = wrapAngularDevkitSchematic(
    '@schematics/angular',
    'component'
  );
  await angularComponentSchematic(tree, {
    ...schematicOptions,
    skipImport: true,
    export: false,
  });

  const componentFileInfo = getComponentFileInfo(tree, options);
  convertComponentToScam(tree, componentFileInfo, options);
  exportScam(tree, componentFileInfo, options);

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
