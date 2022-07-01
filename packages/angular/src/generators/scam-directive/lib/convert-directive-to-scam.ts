import type { Tree } from '@nrwl/devkit';
import { joinPathFragments, names } from '@nrwl/devkit';
import { insertImport } from '@nrwl/workspace/src/utilities/ast-utils';
import { createSourceFile, ScriptTarget } from 'typescript';
import type { FileInfo } from '../../utils/file-info';
import type { NormalizedSchema } from '../schema';

export function convertDirectiveToScam(
  tree: Tree,
  directiveFileInfo: FileInfo,
  options: NormalizedSchema
): void {
  if (!tree.exists(directiveFileInfo.filePath)) {
    throw new Error(
      `Couldn't find directive at path ${directiveFileInfo.filePath} to add SCAM setup.`
    );
  }

  const directiveNames = names(options.name);
  const typeNames = names('directive');
  const directiveClassName = `${directiveNames.className}${typeNames.className}`;

  if (options.inlineScam) {
    const currentDirectiveContents = tree.read(
      directiveFileInfo.filePath,
      'utf-8'
    );
    let source = createSourceFile(
      directiveFileInfo.filePath,
      currentDirectiveContents,
      ScriptTarget.Latest,
      true
    );

    source = insertImport(
      tree,
      source,
      directiveFileInfo.filePath,
      'NgModule',
      '@angular/core'
    );
    source = insertImport(
      tree,
      source,
      directiveFileInfo.filePath,
      'CommonModule',
      '@angular/common'
    );

    let updatedDirectiveSource = source.getText();
    updatedDirectiveSource = `${updatedDirectiveSource}${getNgModuleDeclaration(
      directiveClassName
    )}`;

    tree.write(directiveFileInfo.filePath, updatedDirectiveSource);
    return;
  }

  const scamFilePath = joinPathFragments(
    directiveFileInfo.directory,
    `${directiveNames.fileName}.module.ts`
  );

  tree.write(
    scamFilePath,
    getModuleFileContent(directiveClassName, directiveFileInfo.fileName)
  );
}

function getModuleFileContent(
  directiveClassName: string,
  directiveFileName: string
): string {
  return `import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ${directiveClassName} } from './${directiveFileName}';
${getNgModuleDeclaration(directiveClassName)}`;
}

function getNgModuleDeclaration(directiveClassName: string): string {
  return `
@NgModule({
  imports: [CommonModule],
  declarations: [${directiveClassName}],
  exports: [${directiveClassName}],
})
export class ${directiveClassName}Module {}`;
}
