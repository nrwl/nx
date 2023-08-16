import { Tree } from '@nx/devkit';
import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { getNpmScope } from '@nx/js/src/utils/package-json/get-npm-scope';
import { Linter } from '@nx/linter';
import { E2eTestRunner, UnitTestRunner } from '../../../utils/test-runners';
import { normalizeNewProjectPrefix } from '../../utils/project';
import type { Schema } from '../schema';
import type { NormalizedSchema } from './normalized-schema';

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
  });
  options.rootProject = appProjectRoot === '.';
  options.projectNameAndRootFormat = projectNameAndRootFormat;

  let e2eProjectName = 'e2e';
  let e2eProjectRoot = 'e2e';
  if (!options.rootProject) {
    const projectNameAndRoot = await determineProjectNameAndRootOptions(host, {
      name: `${options.name}-e2e`,
      projectType: 'application',
      directory: options.directory,
      projectNameAndRootFormat: options.projectNameAndRootFormat,
      rootProject: options.rootProject,
    });
    e2eProjectName = projectNameAndRoot.projectName;
    e2eProjectRoot = projectNameAndRoot.projectRoot;
  }

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const prefix = normalizeNewProjectPrefix(
    options.prefix,
    getNpmScope(host),
    'app'
  );

  // Set defaults and then overwrite with user options
  return {
    style: 'css',
    routing: false,
    inlineStyle: false,
    inlineTemplate: false,
    skipTests: options.unitTestRunner === UnitTestRunner.None,
    skipFormat: false,
    unitTestRunner: UnitTestRunner.Jest,
    e2eTestRunner: E2eTestRunner.Cypress,
    linter: Linter.EsLint,
    strict: true,
    bundler: options.bundler ?? 'webpack',
    ...options,
    prefix,
    name: appProjectName,
    appProjectRoot,
    e2eProjectRoot,
    e2eProjectName,
    parsedTags,
  };
}
