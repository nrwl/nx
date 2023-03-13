import type { Tree } from '@nrwl/devkit';
import { joinPathFragments, names } from '@nrwl/devkit';
import { ensureTypescript } from '@nrwl/js/src/utils/typescript/ensure-typescript';
import { insertImport } from '@nrwl/js';
import type { FileInfo } from '../../utils/file-info';
import type { NormalizedSchema } from '../schema';

let tsModule: typeof import('typescript');

export function convertComponentToScam(
  tree: Tree,
  componentFileInfo: FileInfo,
  options: NormalizedSchema
) {
  if (!tree.exists(componentFileInfo.filePath)) {
    throw new Error(
      `Couldn't find component at path ${componentFileInfo.filePath} to add SCAM setup.`
    );
  }

  const componentNames = names(options.name);
  const typeNames = names(options.type ?? 'component');
  const componentClassName = `${componentNames.className}${typeNames.className}`;

  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  if (options.inlineScam) {
    const currentComponentContents = tree.read(
      componentFileInfo.filePath,
      'utf-8'
    );
    let source = tsModule.createSourceFile(
      componentFileInfo.filePath,
      currentComponentContents,
      tsModule.ScriptTarget.Latest,
      true
    );

    source = insertImport(
      tree,
      source,
      componentFileInfo.filePath,
      'NgModule',
      '@angular/core'
    );
    source = insertImport(
      tree,
      source,
      componentFileInfo.filePath,
      'CommonModule',
      '@angular/common'
    );

    let updatedComponentSource = source.getText();
    updatedComponentSource = `${updatedComponentSource}${getNgModuleDeclaration(
      componentClassName
    )}`;

    tree.write(componentFileInfo.filePath, updatedComponentSource);
    return;
  }

  const moduleFilePath = joinPathFragments(
    componentFileInfo.directory,
    `${componentNames.fileName}.module.ts`
  );

  tree.write(
    moduleFilePath,
    getModuleFileContent(componentClassName, componentFileInfo.fileName)
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
