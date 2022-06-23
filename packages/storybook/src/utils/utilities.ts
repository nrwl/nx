import {
  ExecutorContext,
  logger,
  readJson,
  readJsonFile,
  readProjectConfiguration,
  TargetConfiguration,
  Tree,
} from '@nrwl/devkit';
import { CompilerOptions } from 'typescript';
import { storybookVersion } from './versions';
import { StorybookConfig } from '../executors/models';
import { constants, copyFileSync, mkdtempSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { basename, join, sep } from 'path';
import { findNodes } from '@nrwl/workspace/src/utilities/typescript/find-nodes';
import ts = require('typescript');

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
    'react-native': '@storybook/react-native',
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

  if (
    type === 'react-native' &&
    schema.uiFramework === '@storybook/react-native'
  ) {
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

export function readCurrentWorkspaceStorybookVersionFromGenerator(
  tree: Tree
): string {
  const packageJsonContents = readJson(tree, 'package.json');
  return determineStorybookWorkspaceVersion(packageJsonContents);
}

export function readCurrentWorkspaceStorybookVersionFromExecutor() {
  const packageJsonContents = readJsonFile('package.json');
  return determineStorybookWorkspaceVersion(packageJsonContents);
}

function determineStorybookWorkspaceVersion(packageJsonContents) {
  let workspaceStorybookVersion = storybookVersion;

  if (packageJsonContents && packageJsonContents['devDependencies']) {
    if (packageJsonContents['devDependencies']['@storybook/angular']) {
      workspaceStorybookVersion =
        packageJsonContents['devDependencies']['@storybook/angular'];
    }
    if (packageJsonContents['devDependencies']['@storybook/react']) {
      workspaceStorybookVersion =
        packageJsonContents['devDependencies']['@storybook/react'];
    }
    if (packageJsonContents['devDependencies']['@storybook/core']) {
      workspaceStorybookVersion =
        packageJsonContents['devDependencies']['@storybook/core'];
    }
    if (packageJsonContents['devDependencies']['@storybook/react-native']) {
      workspaceStorybookVersion =
        packageJsonContents['devDependencies']['@storybook/react-native'];
    }
  }

  if (packageJsonContents && packageJsonContents['dependencies']) {
    if (packageJsonContents['dependencies']['@storybook/angular']) {
      workspaceStorybookVersion =
        packageJsonContents['dependencies']['@storybook/angular'];
    }
    if (packageJsonContents['dependencies']['@storybook/react']) {
      workspaceStorybookVersion =
        packageJsonContents['dependencies']['@storybook/react'];
    }
    if (packageJsonContents['dependencies']['@storybook/core']) {
      workspaceStorybookVersion =
        packageJsonContents['dependencies']['@storybook/core'];
    }
    if (packageJsonContents['dependencies']['@storybook/react-native']) {
      workspaceStorybookVersion =
        packageJsonContents['dependencies']['@storybook/react-native'];
    }
  }

  return workspaceStorybookVersion;
}

export type TsConfig = {
  extends: string;
  compilerOptions: CompilerOptions;
  files?: string[];
  include?: string[];
  exclude?: string[];
  references?: Array<{ path: string }>;
};

export function findOrCreateConfig(
  config: StorybookConfig,
  context: ExecutorContext
): string {
  if (config?.configFolder && statSync(config.configFolder).isDirectory()) {
    return config.configFolder;
  } else if (
    statSync(config.configPath).isFile() &&
    statSync(config.pluginPath).isFile() &&
    statSync(config.srcRoot).isFile()
  ) {
    return createStorybookConfig(
      config.configPath,
      config.pluginPath,
      config.srcRoot
    );
  } else {
    const sourceRoot = context.workspace.projects[context.projectName].root;
    if (statSync(join(context.root, sourceRoot, '.storybook')).isDirectory()) {
      return join(context.root, sourceRoot, '.storybook');
    }
  }
  throw new Error('No configuration settings');
}

function createStorybookConfig(
  configPath: string,
  pluginPath: string,
  srcRoot: string
): string {
  const tmpDir = tmpdir();
  const tmpFolder = `${tmpDir}${sep}`;
  mkdtempSync(tmpFolder);
  copyFileSync(
    configPath,
    `${tmpFolder}/${basename(configPath)}`,
    constants.COPYFILE_EXCL
  );
  copyFileSync(
    pluginPath,
    `${tmpFolder}/${basename(pluginPath)}`,
    constants.COPYFILE_EXCL
  );
  copyFileSync(
    srcRoot,
    `${tmpFolder}/${basename(srcRoot)}`,
    constants.COPYFILE_EXCL
  );
  return tmpFolder;
}

export function dedupe(arr: string[]) {
  return Array.from(new Set(arr));
}

/**
 * This function is used to find the build targets for Storybook
 * and the project (if it's buildable).
 *
 * The reason this function exists is because we cannot assume
 * that the user has not created a custom build target for the project,
 * or that they have not changed the name of the build target
 * from build to anything else.
 *
 * So, in order to find the correct name of the target,
 * we have to look into all the targets, check the executor
 * they are using, and infer from the executor that the target
 * is a build target.
 */

export function findStorybookAndBuildTargetsAndCompiler(targets: {
  [targetName: string]: TargetConfiguration;
}): {
  storybookBuildTarget?: string;
  storybookTarget?: string;
  ngBuildTarget?: string;
  nextBuildTarget?: string;
  otherBuildTarget?: string;
  compiler?: string;
} {
  const returnObject: {
    storybookBuildTarget?: string;
    storybookTarget?: string;
    ngBuildTarget?: string;
    nextBuildTarget?: string;
    otherBuildTarget?: string;
    compiler?: string;
  } = {};

  Object.entries(targets).forEach(([target, targetConfig]) => {
    switch (targetConfig.executor) {
      case '@storybook/angular:start-storybook':
        returnObject.storybookTarget = target;
        break;
      case '@storybook/angular:build-storybook':
        returnObject.storybookBuildTarget = target;
        break;
      // If it's a non-angular project, these will be the executors
      case '@nrwl/storybook:storybook':
        returnObject.storybookTarget = target;
        break;
      case '@nrwl/storybook:build':
        returnObject.storybookBuildTarget = target;
        break;
      case '@angular-devkit/build-angular:browser':
        /**
         * Not looking for '@nrwl/angular:ng-packagr-lite' or any other
         * angular executors.
         * Only looking for '@angular-devkit/build-angular:browser'
         * because the '@nrwl/angular:ng-packagr-lite' executor
         * (and maybe the other custom exeucutors)
         * does not support styles and extra options, so the user
         * will be forced to switch to build-storybook to add extra options.
         *
         * So we might as well use the build-storybook by default to
         * avoid any errors.
         */
        returnObject.ngBuildTarget = target;
        returnObject.compiler = targetConfig?.options?.compiler;
        break;
      case '@nrwl/next:build':
        returnObject.nextBuildTarget = target;
        returnObject.compiler = targetConfig?.options?.compiler;
        break;
      case '@nrwl/web:webpack':
      case '@nrwl/web:rollup':
      case '@nrwl/js:tsc':
      case '@nrwl/angular:ng-packagr-lite':
        returnObject.otherBuildTarget = target;
        returnObject.compiler = targetConfig?.options?.compiler;
        break;
      default:
        if (targetConfig.options?.compiler) {
          returnObject.otherBuildTarget = target;
          returnObject.compiler = targetConfig?.options?.compiler;
        }
        break;
    }
  });

  return returnObject;
}

export function isTheFileAStory(tree: Tree, path: string): boolean {
  const ext = path.slice(path.lastIndexOf('.'));
  let fileIsStory = false;
  if (ext === '.tsx' || ext === '.ts') {
    const file = getTsSourceFile(tree, path);
    const importArray = findNodes(file, [ts.SyntaxKind.ImportDeclaration]);
    let nodeContainsStorybookImport = false;
    let nodeContainsStoryImport = false;
    importArray.forEach((importNode: ts.ImportClause) => {
      const importPath = findNodes(importNode, [ts.SyntaxKind.StringLiteral]);
      importPath.forEach((importPath: ts.StringLiteral) => {
        if (importPath.getText()?.includes('@storybook/')) {
          nodeContainsStorybookImport = true;
        }
      });
      const importSpecifiers = findNodes(importNode, [
        ts.SyntaxKind.ImportSpecifier,
      ]);
      importSpecifiers.forEach((importSpecifier: ts.ImportSpecifier) => {
        if (
          importSpecifier.getText() === 'Story' ||
          importSpecifier.getText() === 'storiesOf' ||
          importSpecifier.getText() === 'ComponentStory'
        ) {
          nodeContainsStoryImport = true;
        }
      });

      // We place this check within the loop, because we want the
      // import combination of Story from @storybook/*
      if (nodeContainsStorybookImport && nodeContainsStoryImport) {
        fileIsStory = true;
      }
    });
  } else {
    fileIsStory =
      (path.endsWith('.js') && path.endsWith('.stories.js')) ||
      (path.endsWith('.jsx') && path.endsWith('.stories.jsx'));
  }

  return fileIsStory;
}

export function getTsSourceFile(host: Tree, path: string): ts.SourceFile {
  const buffer = host.read(path);
  if (!buffer) {
    throw new Error(`Could not read TS file (${path}).`);
  }
  const content = buffer.toString();
  const source = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  return source;
}
