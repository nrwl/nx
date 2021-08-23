import type { Tree } from '@nrwl/devkit';
import type { NormalizedSchema } from './normalized-schema';

import * as ts from 'typescript';
import { replaceNodeValue } from '@nrwl/workspace/src/utilities/ast-utils';
import { getDecoratorPropertyValueNode } from '../../../utils/nx-devkit/ast-utils';

import { nrwlHomeTemplate } from './nrwl-home-tpl';

export function updateComponentStyles(host: Tree, options: NormalizedSchema) {
  const content = nrwlHomeTemplate[options.style === 'sass' ? 'sass' : 'css'];

  if (!options.inlineStyle) {
    const filesMap = {
      css: `${options.appProjectRoot}/src/app/app.component.css`,
      sass: `${options.appProjectRoot}/src/app/app.component.sass`,
      scss: `${options.appProjectRoot}/src/app/app.component.scss`,
      less: `${options.appProjectRoot}/src/app/app.component.less`,
    };
    host.write(filesMap[options.style], content);

    return;
  }

  // Inline component update
  const componentPath = `${options.appProjectRoot}/src/app/app.component.ts`;
  const templateNodeValue = getDecoratorPropertyValueNode(
    host,
    componentPath,
    'Component',
    'styles',
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
    `[\`\n${content}\n\`],\n`
  );
}
