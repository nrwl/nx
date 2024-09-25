import { joinPathFragments, readNxJson, type Tree } from '@nx/devkit';
import {
  determineProjectNameAndRootOptions,
  ensureProjectName,
} from '@nx/devkit/src/generators/project-name-and-root-utils';
import { Linter } from '@nx/eslint';
import { E2eTestRunner, UnitTestRunner } from '../../../utils/test-runners';
import type { Schema } from '../schema';
import type { NormalizedSchema } from './normalized-schema';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';

export async function normalizeOptions(
  host: Tree,
  options: Partial<Schema>
): Promise<NormalizedSchema> {
  await ensureProjectName(host, options as Schema, 'application');
  const { projectName: appProjectName, projectRoot: appProjectRoot } =
    await determineProjectNameAndRootOptions(host, {
      name: options.name,
      projectType: 'application',
      directory: options.directory,
      rootProject: options.rootProject,
    });
  options.rootProject = appProjectRoot === '.';

  const e2eProjectName = options.rootProject ? 'e2e' : `${appProjectName}-e2e`;
  const e2eProjectRoot = options.rootProject ? 'e2e' : `${appProjectRoot}-e2e`;

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

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
    e2eTestRunner: E2eTestRunner.Playwright,
    linter: Linter.EsLint,
    strict: true,
    standalone: true,
    directory: appProjectRoot,
    ...options,
    prefix: options.prefix || 'app',
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
