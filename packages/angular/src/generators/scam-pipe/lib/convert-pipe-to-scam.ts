import type { Tree } from '@nx/devkit';
import { insertImport } from '@nx/js';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import type { NormalizedSchema } from '../schema';

let tsModule: typeof import('typescript');

export function convertPipeToScam(tree: Tree, options: NormalizedSchema) {
  if (!tree.exists(options.filePath)) {
    throw new Error(
      `Couldn't find pipe at path ${options.filePath} to add SCAM setup.`
    );
  }
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  if (options.inlineScam) {
    const currentPipeContents = tree.read(options.filePath, 'utf-8');
    let source = tsModule.createSourceFile(
      options.filePath,
      currentPipeContents,
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

    let updatedPipeSource = source.getText();
    updatedPipeSource = `${updatedPipeSource}${getNgModuleDeclaration(
      options.symbolName
    )}`;

    tree.write(options.filePath, updatedPipeSource);
    return;
  }

  tree.write(
    options.modulePath,
    getModuleFileContent(options.symbolName, options.fileName)
  );
}

function getModuleFileContent(
  pipeClassName: string,
  pipeFileName: string
): string {
  return `import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ${pipeClassName} } from './${pipeFileName}';
${getNgModuleDeclaration(pipeClassName)}`;
}

function getNgModuleDeclaration(pipeClassName: string): string {
  return `
@NgModule({
  imports: [CommonModule],
  declarations: [${pipeClassName}],
  exports: [${pipeClassName}],
})
export class ${pipeClassName}Module {}
`;
}
