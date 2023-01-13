import type { Tree } from '@nrwl/devkit';
import {
  formatFiles,
  normalizePath,
  readNxJson,
  readProjectConfiguration,
  stripIndents,
} from '@nrwl/devkit';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';
import { pathStartsWith } from '../utils/path';
import { exportComponentInEntryPoint } from './lib/component';
import { normalizeOptions } from './lib/normalize-options';
import type { NormalizedSchema, Schema } from './schema';
import { getInstalledAngularVersionInfo } from '../utils/angular-version-utils';
import { lt } from 'semver';

export async function componentGenerator(tree: Tree, rawOptions: Schema) {
  const installedAngularVersionInfo = getInstalledAngularVersionInfo(tree);

  if (
    lt(installedAngularVersionInfo.version, '14.1.0') &&
    rawOptions.standalone
  ) {
    throw new Error(stripIndents`The "standalone" option is only supported in Angular >= 14.1.0. You are currently using ${installedAngularVersionInfo.version}.
    You can resolve this error by removing the "standalone" option or by migrating to Angular 14.1.0.`);
  }

  const options = await normalizeOptions(tree, rawOptions);
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

  const project = schema.project ?? readNxJson(tree).defaultProject;
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
