import { logger, readJson, Tree } from '@nrwl/devkit';
import type { Schema } from '../schema';

import {
  readProjectConfiguration,
  joinPathFragments,
  names,
  readWorkspaceConfiguration,
  normalizePath,
} from '@nrwl/devkit';
import { insertImport } from '@nrwl/workspace/src/utilities/ast-utils';
import { createSourceFile, ScriptTarget } from 'typescript';

export function createScam(tree: Tree, schema: Schema) {
  const project =
    schema.project ?? readWorkspaceConfiguration(tree).defaultProject;
  const projectConfig = readProjectConfiguration(tree, project);

  const componentNames = names(schema.name);
  const typeNames = names(schema.type ?? 'component');

  const componentFileName = `${componentNames.fileName}.${
    schema.type ?? 'component'
  }`;

  let componentDirectory = schema.flat
    ? joinPathFragments(
        projectConfig.sourceRoot,
        projectConfig.projectType === 'application' ? 'app' : 'lib'
      )
    : joinPathFragments(
        projectConfig.sourceRoot,
        projectConfig.projectType === 'application' ? 'app' : 'lib',
        componentNames.fileName
      );

  if (schema.path) {
    componentDirectory = schema.flat
      ? normalizePath(schema.path)
      : joinPathFragments(schema.path, componentNames.fileName);
  }

  const componentFilePath = joinPathFragments(
    componentDirectory,
    `${componentFileName}.ts`
  );

  if (!tree.exists(componentFilePath)) {
    throw new Error(
      `Couldn't find component at path ${componentFilePath} to add SCAM setup.`
    );
  }

  if (schema.inlineScam) {
    const currentComponentContents = tree.read(componentFilePath, 'utf-8');
    let source = createSourceFile(
      componentFilePath,
      currentComponentContents,
      ScriptTarget.Latest,
      true
    );

    source = insertImport(
      tree,
      source,
      componentFilePath,
      'NgModule',
      '@angular/core'
    );

    source = insertImport(
      tree,
      source,
      componentFilePath,
      'CommonModule',
      '@angular/common'
    );

    let updatedComponentSource = source.getText();

    updatedComponentSource = `${updatedComponentSource}${createAngularComponentModule(
      `${componentNames.className}${typeNames.className}`
    )}`;

    tree.write(componentFilePath, updatedComponentSource);
    exportScam(tree, schema, componentFilePath);
    return;
  }

  const scamFilePath = joinPathFragments(
    componentDirectory,
    `${componentNames.fileName}.module.ts`
  );

  tree.write(
    scamFilePath,
    createSeparateAngularComponentModuleFile(
      `${componentNames.className}${typeNames.className}`,
      componentFileName
    )
  );

  exportScam(tree, schema, scamFilePath);
}

function exportScam(tree: Tree, schema: Schema, scamFilePath: string) {
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
      '--export=true was ignored as the project the SCAM is being generated in is not a library.'
    );

    return;
  }

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
      `Could not export SCAM. Unable to determine project's entry point. Path ${projectEntryPoint} does not exist. SCAM has still been created.`
    );

    return;
  }

  const relativePathFromEntryPoint = `.${scamFilePath
    .split(sourceRoot)[1]
    .replace('.ts', '')}`;

  const updateEntryPointContent = `${tree.read(projectEntryPoint, 'utf-8')}
  export * from "${relativePathFromEntryPoint}";`;

  tree.write(projectEntryPoint, updateEntryPointContent);
}

function createAngularComponentModule(name: string) {
  return `
@NgModule({
  imports: [CommonModule],
  declarations: [${name}],
  exports: [${name}],
})
export class ${name}Module {}`;
}

function createSeparateAngularComponentModuleFile(
  name: string,
  componentFileName: string
) {
  return `import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ${name} } from './${componentFileName}';
${createAngularComponentModule(name)}`;
}
