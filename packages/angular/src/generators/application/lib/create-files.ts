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
  const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);
  const isUsingApplicationBuilder =
    angularMajorVersion >= 17 && options.bundler === 'esbuild';

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
    angularMajorVersion,
    rootOffset,
    isUsingApplicationBuilder,
    tpl: '',
  };

  generateFiles(
    tree,
    joinPathFragments(__dirname, '../files/base'),
    options.appProjectRoot,
    substitutions
  );

  if (options.standalone) {
    generateFiles(
      tree,
      joinPathFragments(__dirname, '../files/standalone-components'),
      options.appProjectRoot,
      substitutions
    );
  } else {
    generateFiles(
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
    {
      bundler: options.bundler,
      rootProject: options.rootProject,
      strict: options.strict,
      style: options.style,
      esModuleInterop: isUsingApplicationBuilder,
    },
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
