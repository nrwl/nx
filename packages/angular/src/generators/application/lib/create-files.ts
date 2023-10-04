import type { Tree } from '@nx/devkit';
import { generateFiles, joinPathFragments } from '@nx/devkit';
import type { NormalizedSchema } from './normalized-schema';
import { getRelativePathToRootTsConfig, getRootTsConfigFileName } from '@nx/js';
import { createTsConfig } from '../../utils/create-ts-config';
import { UnitTestRunner } from '../../../utils/test-runners';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';

export async function createFiles(
  tree: Tree,
  options: NormalizedSchema,
  rootOffset: string
) {
  const installedAngularInfo = getInstalledAngularVersionInfo(tree);
  const substitutions = {
    rootSelector: `${options.prefix}-root`,
    appName: options.name,
    inlineStyle: options.inlineStyle,
    inlineTemplate: options.inlineTemplate,
    style: options.style,
    viewEncapsulation: options.viewEncapsulation,
    unitTesting: options.unitTestRunner !== UnitTestRunner.None,
    routing: options.routing,
    minimal: options.minimal,
    nxWelcomeSelector: `${options.prefix}-nx-welcome`,
    rootTsConfig: joinPathFragments(rootOffset, getRootTsConfigFileName(tree)),
    installedAngularInfo,
    rootOffset,
    tpl: '',
  };

  generateFiles(
    tree,
    joinPathFragments(__dirname, '../files/base'),
    options.appProjectRoot,
    substitutions
  );

  if (installedAngularInfo.major === 14) {
    generateFiles(
      tree,
      joinPathFragments(__dirname, '../files/v14'),
      options.appProjectRoot,
      substitutions
    );
  }

  if (options.standalone) {
    generateFiles(
      tree,
      joinPathFragments(__dirname, '../files/standalone-components'),
      options.appProjectRoot,
      substitutions
    );
  } else {
    await generateFiles(
      tree,
      joinPathFragments(__dirname, '../files/ng-module'),
      options.appProjectRoot,
      substitutions
    );
  }

  createTsConfig(
    tree,
    options.appProjectRoot,
    'app',
    options,
    getRelativePathToRootTsConfig(tree, options.appProjectRoot)
  );

  if (!options.routing) {
    tree.delete(
      joinPathFragments(options.appProjectRoot, '/src/app/app.routes.ts')
    );
  }

  if (options.skipTests || options.unitTestRunner === UnitTestRunner.None) {
    tree.delete(
      joinPathFragments(
        options.appProjectRoot,
        '/src/app/app.component.spec.ts'
      )
    );
  }

  if (options.inlineTemplate) {
    tree.delete(
      joinPathFragments(options.appProjectRoot, '/src/app/app.component.html')
    );
  }

  if (options.inlineStyle) {
    tree.delete(
      joinPathFragments(
        options.appProjectRoot,
        `/src/app/app.component.${options.style}`
      )
    );
  }

  if (options.minimal) {
    tree.delete(
      joinPathFragments(
        options.appProjectRoot,
        'src/app/nx-welcome.component.ts'
      )
    );
  }
}
