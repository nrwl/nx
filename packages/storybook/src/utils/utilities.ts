import { Tree } from '@nrwl/devkit';

import { CompilerOptions } from 'typescript';

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
  include?: string[];
  exclude?: string[];
  references?: Array<{ path: string }>;
};
