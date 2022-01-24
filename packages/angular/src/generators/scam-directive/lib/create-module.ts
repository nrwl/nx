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

export function createScamDirective(tree: Tree, schema: Schema) {
  const project =
    schema.project ?? readWorkspaceConfiguration(tree).defaultProject;
  const projectConfig = readProjectConfiguration(tree, project);

  const directiveNames = names(schema.name);
  const typeNames = names('directive');

  const directiveFileName = `${directiveNames.fileName}.directive`;

  let directiveDirectory = schema.flat
    ? joinPathFragments(
        projectConfig.sourceRoot,
        projectConfig.projectType === 'application' ? 'app' : 'lib'
      )
    : joinPathFragments(
        projectConfig.sourceRoot,
        projectConfig.projectType === 'application' ? 'app' : 'lib',
        directiveNames.fileName
      );

  if (schema.path) {
    directiveDirectory = schema.flat
      ? normalizePath(schema.path)
      : joinPathFragments(schema.path, directiveNames.fileName);
  }

  const directiveFilePath = joinPathFragments(
    directiveDirectory,
    `${directiveFileName}.ts`
  );

  if (!tree.exists(directiveFilePath)) {
    throw new Error(
      `Couldn't find directive at path ${directiveFilePath} to add SCAM setup.`
    );
  }

  if (schema.inlineScam) {
    const currentDirectiveContents = tree.read(directiveFilePath, 'utf-8');
    let source = createSourceFile(
      directiveFilePath,
      currentDirectiveContents,
      ScriptTarget.Latest,
      true
    );

    source = insertImport(
      tree,
      source,
      directiveFilePath,
      'NgModule',
      '@angular/core'
    );

    source = insertImport(
      tree,
      source,
      directiveFilePath,
      'CommonModule',
      '@angular/common'
    );

    let updatedDirectiveSource = source.getText();

    updatedDirectiveSource = `${updatedDirectiveSource}${createAngularDirectiveModule(
      `${directiveNames.className}${typeNames.className}`
    )}`;

    tree.write(directiveFilePath, updatedDirectiveSource);
    exportScam(tree, schema, directiveFilePath);
    return;
  }

  const scamFilePath = joinPathFragments(
    directiveDirectory,
    `${directiveNames.fileName}.module.ts`
  );

  tree.write(
    scamFilePath,
    createSeparateAngularDirectiveModuleFile(
      `${directiveNames.className}${typeNames.className}`,
      directiveFileName
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

  const updateEntryPointContent = `${tree.read(projectEntryPoint)}
  export * from "${relativePathFromEntryPoint}";`;

  tree.write(projectEntryPoint, updateEntryPointContent);
}

function createAngularDirectiveModule(name: string) {
  return `
@NgModule({
  imports: [CommonModule],
  declarations: [${name}],
  exports: [${name}],
})
export class ${name}Module {}`;
}

function createSeparateAngularDirectiveModuleFile(
  name: string,
  directiveFileName: string
) {
  return `import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ${name} } from './${directiveFileName}';
${createAngularDirectiveModule(name)}`;
}
