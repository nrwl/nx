import type { Tree } from '@nrwl/devkit';
import {
  formatFiles,
  joinPathFragments,
  logger,
  names,
  normalizePath,
  readProjectConfiguration,
  readWorkspaceConfiguration,
  stripIndents,
} from '@nrwl/devkit';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';
import { pathStartsWith } from '../utils/path';
import {
  findModuleFromOptions,
  getRelativeImportToFile,
  locateLibraryEntryPointFromDirectory,
  shouldExportInEntryPoint,
} from './lib';
import type { Schema } from './schema';

export async function componentGenerator(tree: Tree, schema: Schema) {
  checkPathUnderProjectRoot(tree, schema);

  const angularComponentSchematic = wrapAngularDevkitSchematic(
    '@schematics/angular',
    'component'
  );
  await angularComponentSchematic(tree, { ...schema });

  exportComponentInEntryPoint(tree, schema);

  await formatFiles(tree);
}

function checkPathUnderProjectRoot(tree: Tree, schema: Schema): void {
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

function exportComponentInEntryPoint(tree: Tree, schema: Schema): void {
  if (!schema.export || schema.skipImport) {
    return;
  }

  const project =
    schema.project ?? readWorkspaceConfiguration(tree).defaultProject;

  const { root, sourceRoot, projectType } = readProjectConfiguration(
    tree,
    project
  );

  if (projectType === 'application') {
    return;
  }

  const componentNames = names(schema.name);

  const componentFileName = `${componentNames.fileName}.${
    schema.type ? names(schema.type).fileName : 'component'
  }`;

  const projectSourceRoot = sourceRoot ?? joinPathFragments(root, 'src');
  schema.path ??= joinPathFragments(projectSourceRoot, 'lib');
  const componentDirectory = schema.flat
    ? normalizePath(schema.path)
    : joinPathFragments(schema.path, componentNames.fileName);

  const componentFilePath = joinPathFragments(
    componentDirectory,
    `${componentFileName}.ts`
  );

  const entryPointPath = locateLibraryEntryPointFromDirectory(
    tree,
    componentDirectory,
    root,
    projectSourceRoot
  );
  if (!entryPointPath) {
    logger.warn(
      `Unable to determine whether the component should be exported in the library entry point file. ` +
        `The library's entry point file could not be found. Skipping exporting the component in the entry point file.`
    );

    return;
  }

  const modulePath = findModuleFromOptions(tree, schema, root);
  if (!shouldExportInEntryPoint(tree, entryPointPath, modulePath)) {
    return;
  }

  const relativePathFromEntryPoint = getRelativeImportToFile(
    entryPointPath,
    componentFilePath
  );
  const updateEntryPointContent = stripIndents`${tree.read(
    entryPointPath,
    'utf-8'
  )}
    export * from "${relativePathFromEntryPoint}";`;

  tree.write(entryPointPath, updateEntryPointContent);
}

export default componentGenerator;
