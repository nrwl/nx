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
    return;
  }

  tree.write(
    joinPathFragments(
      componentDirectory,
      `${componentNames.fileName}.module.ts`
    ),
    createSeparateAngularComponentModuleFile(
      `${componentNames.className}${typeNames.className}`,
      componentFileName
    )
  );
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
