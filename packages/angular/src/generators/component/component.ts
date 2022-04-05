import { joinPathFragments, logger, names, readJson, Tree } from '@nrwl/devkit';
import type { Schema } from './schema';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';
import {
  formatFiles,
  readWorkspaceConfiguration,
  readProjectConfiguration,
  normalizePath,
} from '@nrwl/devkit';
import { pathStartsWith } from '../utils/path';

export async function componentGenerator(tree: Tree, schema: Schema) {
  checkPathUnderProjectRoot(tree, schema);

  const angularComponentSchematic = wrapAngularDevkitSchematic(
    '@schematics/angular',
    'component'
  );
  await angularComponentSchematic(tree, {
    ...schema,
  });

  exportComponent(tree, schema);

  await formatFiles(tree);
}

function checkPathUnderProjectRoot(tree: Tree, schema: Partial<Schema>) {
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
      `The path provided for the component (${schema.path}) does not exist under the project root (${root}).`
    );
  }
}

function exportComponent(tree: Tree, schema: Schema) {
  if (!schema.export) {
    return;
  }

  const project =
    schema.project ?? readWorkspaceConfiguration(tree).defaultProject;

  const { root, sourceRoot, projectType } = readProjectConfiguration(
    tree,
    project
  );

  if (projectType === 'application') {
    logger.warn(
      '--export=true was ignored as the project the component being generated in is not a library.'
    );

    return;
  }

  const componentNames = names(schema.name);

  const componentFileName = `${componentNames.fileName}.${
    schema.type ?? 'component'
  }`;

  let componentDirectory = schema.flat
    ? joinPathFragments(sourceRoot, 'lib')
    : joinPathFragments(sourceRoot, 'lib', componentNames.fileName);

  if (schema.path) {
    componentDirectory = schema.flat
      ? normalizePath(schema.path)
      : joinPathFragments(schema.path, componentNames.fileName);
  }

  const componentFilePath = joinPathFragments(
    componentDirectory,
    `${componentFileName}.ts`
  );

  const ngPackageJsonPath = joinPathFragments(root, 'ng-package.json');
  const ngPackageEntryPoint = tree.exists(ngPackageJsonPath)
    ? readJson(tree, ngPackageJsonPath).lib?.entryFile
    : undefined;

  const projectEntryPoint = ngPackageEntryPoint
    ? joinPathFragments(root, ngPackageEntryPoint)
    : joinPathFragments(sourceRoot, `index.ts`);

  if (!tree.exists(projectEntryPoint)) {
    // Let's not error, simply warn the user
    // It's not too much effort to manually do this
    // It would be more frustrating to have to find the correct path and re-run the command
    logger.warn(
      `Could not export the component in the library's entry point. Unable to determine project's entry point. The path ${projectEntryPoint} does not exist. The component has still been created.`
    );

    return;
  }

  const relativePathFromEntryPoint = `.${componentFilePath
    .split(sourceRoot)[1]
    .replace('.ts', '')}`;

  const updateEntryPointContent = `${tree.read(projectEntryPoint, 'utf-8')}
    export * from "${relativePathFromEntryPoint}";`;

  tree.write(projectEntryPoint, updateEntryPointContent);
}

export default componentGenerator;
