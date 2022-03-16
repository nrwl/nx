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

export function createScamPipe(tree: Tree, schema: Schema) {
  const project =
    schema.project ?? readWorkspaceConfiguration(tree).defaultProject;
  const projectConfig = readProjectConfiguration(tree, project);

  const pipeNames = names(schema.name);
  const typeNames = names('pipe');

  const pipeFileName = `${pipeNames.fileName}.pipe`;

  let pipeDirectory = schema.flat
    ? joinPathFragments(
        projectConfig.sourceRoot,
        projectConfig.projectType === 'application' ? 'app' : 'lib'
      )
    : joinPathFragments(
        projectConfig.sourceRoot,
        projectConfig.projectType === 'application' ? 'app' : 'lib',
        pipeNames.fileName
      );

  if (schema.path) {
    pipeDirectory = schema.flat
      ? normalizePath(schema.path)
      : joinPathFragments(schema.path, pipeNames.fileName);
  }

  const pipeFilePath = joinPathFragments(pipeDirectory, `${pipeFileName}.ts`);

  if (!tree.exists(pipeFilePath)) {
    throw new Error(
      `Couldn't find pipe at path ${pipeFilePath} to add SCAM setup.`
    );
  }

  if (schema.inlineScam) {
    const currentPipeContents = tree.read(pipeFilePath, 'utf-8');
    let source = createSourceFile(
      pipeFilePath,
      currentPipeContents,
      ScriptTarget.Latest,
      true
    );

    source = insertImport(
      tree,
      source,
      pipeFilePath,
      'NgModule',
      '@angular/core'
    );

    source = insertImport(
      tree,
      source,
      pipeFilePath,
      'CommonModule',
      '@angular/common'
    );

    let updatedPipeSource = source.getText();

    updatedPipeSource = `${updatedPipeSource}${createAngularPipeModule(
      `${pipeNames.className}${typeNames.className}`
    )}`;

    tree.write(pipeFilePath, updatedPipeSource);
    exportScam(tree, schema, pipeFilePath);
    return;
  }

  const scamFilePath = joinPathFragments(
    pipeDirectory,
    `${pipeNames.fileName}.module.ts`
  );

  tree.write(
    scamFilePath,
    createSeparateAngularPipeModuleFile(
      `${pipeNames.className}${typeNames.className}`,
      pipeFileName
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

function createAngularPipeModule(name: string) {
  return `
@NgModule({
  imports: [CommonModule],
  declarations: [${name}],
  exports: [${name}],
})
export class ${name}Module {}`;
}

function createSeparateAngularPipeModuleFile(
  name: string,
  pipeFileName: string
) {
  return `import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ${name} } from './${pipeFileName}';
${createAngularPipeModule(name)}`;
}
