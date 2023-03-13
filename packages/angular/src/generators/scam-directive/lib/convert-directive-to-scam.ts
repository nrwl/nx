import type { Tree } from '@nrwl/devkit';
import { joinPathFragments, names } from '@nrwl/devkit';
import { ensureTypescript } from '@nrwl/js/src/utils/typescript/ensure-typescript';
import { insertImport } from '@nrwl/js';
import type { FileInfo } from '../../utils/file-info';
import type { NormalizedSchema } from '../schema';

let tsModule: typeof import('typescript');

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
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  const directiveNames = names(options.name);
  const typeNames = names('directive');
  const directiveClassName = `${directiveNames.className}${typeNames.className}`;

  if (options.inlineScam) {
    const currentDirectiveContents = tree.read(
      directiveFileInfo.filePath,
      'utf-8'
    );
    let source = tsModule.createSourceFile(
      directiveFileInfo.filePath,
      currentDirectiveContents,
      tsModule.ScriptTarget.Latest,
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
