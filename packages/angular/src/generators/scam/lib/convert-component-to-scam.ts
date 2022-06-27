import type { Tree } from '@nrwl/devkit';
import { joinPathFragments, names } from '@nrwl/devkit';
import { insertImport } from '@nrwl/workspace/src/utilities/ast-utils';
import { createSourceFile, ScriptTarget } from 'typescript';
import type { Schema } from '../schema';
import type { ComponentFileInfo } from '../../utils/component';

export function convertComponentToScam(
  tree: Tree,
  {
    componentDirectory,
    componentFileName,
    componentFilePath,
  }: ComponentFileInfo,
  options: Schema
) {
  if (!tree.exists(componentFilePath)) {
    throw new Error(
      `Couldn't find component at path ${componentFilePath} to add SCAM setup.`
    );
  }

  const componentNames = names(options.name);
  const typeNames = names(options.type ?? 'component');
  const componentClassName = `${componentNames.className}${typeNames.className}`;

  if (options.inlineScam) {
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
    updatedComponentSource = `${updatedComponentSource}${getNgModuleDeclaration(
      componentClassName
    )}`;

    tree.write(componentFilePath, updatedComponentSource);
    return;
  }

  const moduleFilePath = joinPathFragments(
    componentDirectory,
    `${componentNames.fileName}.module.ts`
  );

  tree.write(
    moduleFilePath,
    getModuleFileContent(componentClassName, componentFileName)
  );
}

function getModuleFileContent(
  componentClassName: string,
  componentFileName: string
): string {
  return `import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ${componentClassName} } from './${componentFileName}';
${getNgModuleDeclaration(componentClassName)}`;
}

function getNgModuleDeclaration(componentClassName: string): string {
  return `
@NgModule({
  imports: [CommonModule],
  declarations: [${componentClassName}],
  exports: [${componentClassName}],
})
export class ${componentClassName}Module {}`;
}
