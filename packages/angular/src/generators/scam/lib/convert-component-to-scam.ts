import type { Tree } from '@nx/devkit';
import { joinPathFragments, names } from '@nx/devkit';
import { insertImport } from '@nx/js';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import type { NormalizedSchema } from '../schema';

let tsModule: typeof import('typescript');

export function convertComponentToScam(tree: Tree, options: NormalizedSchema) {
  if (!tree.exists(options.filePath)) {
    throw new Error(
      `Couldn't find component at path ${options.filePath} to add SCAM setup.`
    );
  }

  const componentNames = names(options.name);
  const typeNames = names(options.type ?? 'component');
  const componentClassName = `${componentNames.className}${typeNames.className}`;

  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  if (options.inlineScam) {
    const currentComponentContents = tree.read(options.filePath, 'utf-8');
    let source = tsModule.createSourceFile(
      options.filePath,
      currentComponentContents,
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

    let updatedComponentSource = source.getText();
    updatedComponentSource = `${updatedComponentSource}${getNgModuleDeclaration(
      componentClassName
    )}`;

    tree.write(options.filePath, updatedComponentSource);
    return;
  }

  const moduleFilePath = joinPathFragments(
    options.directory,
    `${componentNames.fileName}.module.ts`
  );

  tree.write(
    moduleFilePath,
    getModuleFileContent(componentClassName, options.fileName)
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
