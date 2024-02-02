import { joinPathFragments, type Tree } from '@nx/devkit';
import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { Linter } from '@nx/eslint';
import { getNpmScope } from '@nx/js/src/utils/package-json/get-npm-scope';
import { E2eTestRunner, UnitTestRunner } from '../../../utils/test-runners';
import { normalizeNewProjectPrefix } from '../../utils/project';
import type { Schema } from '../schema';
import type { NormalizedSchema } from './normalized-schema';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';

export async function normalizeOptions(
  host: Tree,
  options: Partial<Schema>
): Promise<NormalizedSchema> {
  const {
    projectName: appProjectName,
    projectRoot: appProjectRoot,
    projectNameAndRootFormat,
  } = await determineProjectNameAndRootOptions(host, {
    name: options.name,
    projectType: 'application',
    directory: options.directory,
    projectNameAndRootFormat: options.projectNameAndRootFormat,
    rootProject: options.rootProject,
    callingGenerator: '@nx/angular:application',
  });
  options.rootProject = appProjectRoot === '.';
  options.projectNameAndRootFormat = projectNameAndRootFormat;
  options.addPlugin ??= process.env.NX_ADD_PLUGINS !== 'false';

  const e2eProjectName = options.rootProject ? 'e2e' : `${appProjectName}-e2e`;
  const e2eProjectRoot = options.rootProject ? 'e2e' : `${appProjectRoot}-e2e`;

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const prefix = normalizeNewProjectPrefix(
    options.prefix,
    getNpmScope(host),
    'app'
  );

  let bundler = options.bundler;
  if (!bundler) {
    const { major: angularMajorVersion } = getInstalledAngularVersionInfo(host);
    bundler = angularMajorVersion >= 17 ? 'esbuild' : 'webpack';
  }

  // Set defaults and then overwrite with user options
  return {
    style: 'css',
    routing: true,
    inlineStyle: false,
    inlineTemplate: false,
    skipTests: options.unitTestRunner === UnitTestRunner.None,
    skipFormat: false,
    unitTestRunner: UnitTestRunner.Jest,
    e2eTestRunner: E2eTestRunner.Cypress,
    linter: Linter.EsLint,
    strict: true,
    standalone: true,
    ...options,
    prefix,
    name: appProjectName,
    appProjectRoot,
    appProjectSourceRoot: `${appProjectRoot}/src`,
    e2eProjectRoot,
    e2eProjectName,
    parsedTags,
    bundler,
    outputPath: joinPathFragments(
      'dist',
      !options.rootProject ? appProjectRoot : appProjectName
    ),
    ssr: options.ssr ?? false,
  };
}
