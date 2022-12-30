import type { Tree } from '@nrwl/devkit';
import type { NormalizedSchema } from './normalized-schema';

import * as ts from 'typescript';
import {
  addGlobal,
  replaceNodeValue,
} from '@nrwl/workspace/src/utilities/ast-utils';
import { getDecoratorPropertyValueNode } from '../../../utils/nx-devkit/ast-utils';
import { nrwlHomeTemplate } from './nrwl-home-tpl';

export function updateNxComponentTemplate(
  host: Tree,
  options: NormalizedSchema
) {
  const componentPath = `${options.appProjectRoot}/src/app/nx-welcome.component.ts`;
  const templateNodeValue = getDecoratorPropertyValueNode(
    host,
    componentPath,
    'Component',
    'template',
    '@angular/core'
  );

  replaceNodeValue(
    host,
    ts.createSourceFile(
      componentPath,
      host.read(componentPath, 'utf-8'),
      ts.ScriptTarget.Latest,
      true
    ),
    componentPath,
    templateNodeValue,
    `\`\n${nrwlHomeTemplate.template(options.name)}\n\``
  );

  // Fixing extra comma issue `,,`
  let sourceFile = ts.createSourceFile(
    componentPath,
    host.read(componentPath, 'utf-8'),
    ts.ScriptTarget.Latest,
    true
  );
  const componentFile = host
    .read(componentPath, 'utf-8')
    .toString()
    .replace(/,,/gi, ',');
  host.write(componentPath, componentFile);
  sourceFile.update(componentFile, {
    newLength: componentFile.length,
    span: {
      length: sourceFile.text.length,
      start: 0,
    },
  });

  // Add ESLint ignore to pass the lint step
  sourceFile = ts.createSourceFile(
    componentPath,
    host.read(componentPath, 'utf-8'),
    ts.ScriptTarget.Latest,
    true
  );
  addGlobal(host, sourceFile, componentPath, '/* eslint-disable */');
}
