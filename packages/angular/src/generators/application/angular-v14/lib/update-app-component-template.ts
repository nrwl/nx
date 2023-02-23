import type { Tree } from '@nrwl/devkit';
import type * as ts from 'typescript';
import { replaceNodeValue } from '@nrwl/workspace/src/utilities/ast-utils';
import { ensureTypescript } from '@nrwl/js/src/utils/typescript/ensure-typescript';
import { getDecoratorPropertyValueNode } from '../../../../utils/nx-devkit/ast-utils';
import { nrwlHomeTemplate } from './nrwl-home-tpl';
import type { NormalizedSchema } from './normalized-schema';

let tsModule: typeof import('typescript');

export function updateAppComponentTemplate(
  host: Tree,
  options: NormalizedSchema
) {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const content = options.routing
    ? `${nrwlHomeTemplate.getSelector(
        options.prefix
      )}\n<router-outlet></router-outlet>`
    : nrwlHomeTemplate.getSelector(options.prefix);

  if (!options.inlineTemplate) {
    host.write(`${options.appProjectRoot}/src/app/app.component.html`, content);

    return;
  }

  // Inline component update
  const componentPath = `${options.appProjectRoot}/src/app/app.component.ts`;
  const templateNodeValue = getDecoratorPropertyValueNode(
    host,
    componentPath,
    'Component',
    'template',
    '@angular/core'
  );

  replaceNodeValue(
    host,
    tsModule.createSourceFile(
      componentPath,
      host.read(componentPath, 'utf-8'),
      tsModule.ScriptTarget.Latest,
      true
    ),
    componentPath,
    templateNodeValue,
    `\`\n${nrwlHomeTemplate.getSelector(options.prefix)}\n\``
  );
}
