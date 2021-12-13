import type { Tree } from '@nrwl/devkit';
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
    return;
  }

  tree.write(
    joinPathFragments(pipeDirectory, `${pipeNames.fileName}.module.ts`),
    createSeparateAngularPipeModuleFile(
      `${pipeNames.className}${typeNames.className}`,
      pipeFileName
    )
  );
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
