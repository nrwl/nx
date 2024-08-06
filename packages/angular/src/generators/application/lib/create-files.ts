import type { Tree } from '@nx/devkit';
import { generateFiles, joinPathFragments } from '@nx/devkit';
import { getRelativePathToRootTsConfig, getRootTsConfigFileName } from '@nx/js';
import { lt } from 'semver';
import { UnitTestRunner } from '../../../utils/test-runners';
import { validateHtmlSelector } from '../../utils/selector';
import { updateProjectRootTsConfig } from '../../utils/update-project-root-tsconfig';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';
import type { NormalizedSchema } from './normalized-schema';

export async function createFiles(
  tree: Tree,
  options: NormalizedSchema,
  rootOffset: string
) {
  const { major: angularMajorVersion, version: angularVersion } =
    getInstalledAngularVersionInfo(tree);
  const isUsingApplicationBuilder =
    angularMajorVersion >= 17 && options.bundler === 'esbuild';
  const disableModernClassFieldsBehavior = lt(angularVersion, '18.1.0-rc.0');

  const rootSelector = `${options.prefix}-root`;
  validateHtmlSelector(rootSelector);
  const nxWelcomeSelector = `${options.prefix}-nx-welcome`;
  validateHtmlSelector(nxWelcomeSelector);

  const substitutions = {
    rootSelector,
    appName: options.name,
    inlineStyle: options.inlineStyle,
    inlineTemplate: options.inlineTemplate,
    style: options.style,
    viewEncapsulation: options.viewEncapsulation,
    unitTesting: options.unitTestRunner !== UnitTestRunner.None,
    routing: options.routing,
    minimal: options.minimal,
    nxWelcomeSelector,
    rootTsConfig: joinPathFragments(rootOffset, getRootTsConfigFileName(tree)),
    angularMajorVersion,
    rootOffset,
    isUsingApplicationBuilder,
    disableModernClassFieldsBehavior,
    useEventCoalescing: angularMajorVersion >= 18,
    useRouterTestingModule: angularMajorVersion < 18,
    connectCloudUrl: options.connectCloudUrl,
    tutorialUrl: options.rootProject
      ? 'https://nx.dev/getting-started/tutorials/angular-standalone-tutorial?utm_source=nx-project'
      : 'https://nx.dev/getting-started/tutorials/angular-monorepo-tutorial?utm_source=nx-project',
    tpl: '',
  };

  const angularAppType = options.rootProject ? 'standalone' : 'ng-module';
  const nxWelcomePath = {
    unclaimed: `../files/nx-welcome/unclaimed/${angularAppType}`,
    claimed: `../files/nx-welcome/claimed/${angularAppType}`,
    'not-configured': `../files/nx-welcome/not-configured/${angularAppType}`,
  }[options.onBoardingStatus];

  generateFiles(
    tree,
    joinPathFragments(__dirname, '../files/base'),
    options.appProjectRoot,
    substitutions
  );

  if (angularMajorVersion >= 18) {
    generateFiles(
      tree,
      joinPathFragments(__dirname, '../files/base-18+'),
      options.appProjectRoot,
      substitutions
    );
  } else {
    generateFiles(
      tree,
      joinPathFragments(__dirname, '../files/base-pre18'),
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
    generateFiles(
      tree,
      joinPathFragments(__dirname, '../files/ng-module'),
      options.appProjectRoot,
      substitutions
    );
  }

  generateFiles(
    tree,
    joinPathFragments(__dirname, nxWelcomePath),
    options.appProjectRoot,
    substitutions
  );

  updateProjectRootTsConfig(
    tree,
    options.appProjectRoot,
    getRelativePathToRootTsConfig(tree, options.appProjectRoot),
    options.rootProject
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
