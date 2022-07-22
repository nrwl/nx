import type { Tree } from '@nrwl/devkit';
import { joinPathFragments, names } from '@nrwl/devkit';
import { insertImport } from '@nrwl/workspace/src/utilities/ast-utils';
import { createSourceFile, ScriptTarget } from 'typescript';
import type { FileInfo } from '../../utils/file-info';
import type { NormalizedSchema } from '../schema';

export function convertPipeToScam(
  tree: Tree,
  pipeFileInfo: FileInfo,
  options: NormalizedSchema
) {
  if (!tree.exists(pipeFileInfo.filePath)) {
    throw new Error(
      `Couldn't find pipe at path ${pipeFileInfo.filePath} to add SCAM setup.`
    );
  }

  const pipeNames = names(options.name);
  const typeNames = names('pipe');
  const pipeClassName = `${pipeNames.className}${typeNames.className}`;

  if (options.inlineScam) {
    const currentPipeContents = tree.read(pipeFileInfo.filePath, 'utf-8');
    let source = createSourceFile(
      pipeFileInfo.filePath,
      currentPipeContents,
      ScriptTarget.Latest,
      true
    );

    source = insertImport(
      tree,
      source,
      pipeFileInfo.filePath,
      'NgModule',
      '@angular/core'
    );
    source = insertImport(
      tree,
      source,
      pipeFileInfo.filePath,
      'CommonModule',
      '@angular/common'
    );

    let updatedPipeSource = source.getText();
    updatedPipeSource = `${updatedPipeSource}${getNgModuleDeclaration(
      pipeClassName
    )}`;

    tree.write(pipeFileInfo.filePath, updatedPipeSource);
    return;
  }

  const scamFilePath = joinPathFragments(
    pipeFileInfo.directory,
    `${pipeNames.fileName}.module.ts`
  );

  tree.write(
    scamFilePath,
    getModuleFileContent(pipeClassName, pipeFileInfo.fileName)
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
export class ${pipeClassName}Module {}`;
}
