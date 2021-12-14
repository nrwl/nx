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
    return;
  }

  tree.write(
    joinPathFragments(
      directiveDirectory,
      `${directiveNames.fileName}.module.ts`
    ),
    createSeparateAngularDirectiveModuleFile(
      `${directiveNames.className}${typeNames.className}`,
      directiveFileName
    )
  );
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
