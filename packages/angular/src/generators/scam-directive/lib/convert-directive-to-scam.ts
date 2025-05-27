import type { Tree } from '@nx/devkit';
import { insertImport } from '@nx/js';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import type { NormalizedSchema } from '../schema';

let tsModule: typeof import('typescript');

export function convertDirectiveToScam(
  tree: Tree,
  options: NormalizedSchema
): void {
  if (!tree.exists(options.filePath)) {
    throw new Error(
      `Couldn't find directive at path ${options.filePath} to add SCAM setup.`
    );
  }
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  if (options.inlineScam) {
    const currentDirectiveContents = tree.read(options.filePath, 'utf-8');
    let source = tsModule.createSourceFile(
      options.filePath,
      currentDirectiveContents,
      tsModule.ScriptTarget.Latest,
      true
    );

    source = insertImport(
      tree,
      source,
      options.filePath,
      'NgModule',
      '@angular/core'
    );
    source = insertImport(
      tree,
      source,
      options.filePath,
      'CommonModule',
      '@angular/common'
    );

    let updatedDirectiveSource = source.getText();
    updatedDirectiveSource = `${updatedDirectiveSource}${getNgModuleDeclaration(
      options.symbolName
    )}`;

    tree.write(options.filePath, updatedDirectiveSource);
    return;
  }

  tree.write(
    options.modulePath,
    getModuleFileContent(options.symbolName, options.fileName)
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
export class ${directiveClassName}Module {}
`;
}
