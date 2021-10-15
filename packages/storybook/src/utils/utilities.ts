import { Tree } from '@nrwl/devkit';
import { join } from 'path';
import { CompilerOptions } from 'typescript';
import path = require('path');
import { statSync } from 'fs';

export const Constants = {
  addonDependencies: ['@storybook/addons'],
  tsConfigExclusions: ['stories', '**/*.stories.ts'],
  pkgJsonScripts: {
    storybook: 'start-storybook -p 9001 -c .storybook',
  },
  jsonIndentLevel: 2,
  coreAddonPrefix: '@storybook/addon-',
  uiFrameworks: {
    angular: '@storybook/angular',
    react: '@storybook/react',
    html: '@storybook/html',
    'web-components': '@storybook/web-components',
    vue: '@storybook/vue',
    vue3: '@storybook/vue3',
    svelte: '@storybook/svelte',
  } as const,
};
type Constants = typeof Constants;

type Framework = {
  type: keyof Constants['uiFrameworks'];
  uiFramework: Constants['uiFrameworks'][keyof Constants['uiFrameworks']];
};
export function isFramework(
  type: Framework['type'],
  schema: Pick<Framework, 'uiFramework'>
) {
  if (type === 'angular' && schema.uiFramework === '@storybook/angular') {
    return true;
  }
  if (type === 'react' && schema.uiFramework === '@storybook/react') {
    return true;
  }
  if (type === 'html' && schema.uiFramework === '@storybook/html') {
    return true;
  }

  if (
    type === 'web-components' &&
    schema.uiFramework === '@storybook/web-components'
  ) {
    return true;
  }

  if (type === 'vue' && schema.uiFramework === '@storybook/vue') {
    return true;
  }

  if (type === 'vue3' && schema.uiFramework === '@storybook/vue3') {
    return true;
  }

  if (type === 'svelte' && schema.uiFramework === '@storybook/svelte') {
    return true;
  }

  return false;
}

export function safeFileDelete(tree: Tree, path: string): boolean {
  if (tree.exists(path)) {
    tree.delete(path);
    return true;
  } else {
    return false;
  }
}

export type TsConfig = {
  extends: string;
  compilerOptions: CompilerOptions;
  files?: string[];
  include?: string[];
  exclude?: string[];
  references?: Array<{ path: string }>;
};
