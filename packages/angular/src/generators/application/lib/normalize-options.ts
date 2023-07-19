import {
  extractLayoutDirectory,
  getWorkspaceLayout,
  joinPathFragments,
  names,
  Tree,
} from '@nx/devkit';

import { getNpmScope } from '@nx/js/src/utils/package-json/get-npm-scope';

import type { Schema } from '../schema';
import type { NormalizedSchema } from './normalized-schema';
import { E2eTestRunner, UnitTestRunner } from '../../../utils/test-runners';
import { Linter } from '@nx/linter';
import {
  normalizeDirectory,
  normalizeNewProjectPrefix,
  normalizeProjectName,
} from '../../utils/project';

export function normalizeOptions(
  host: Tree,
  options: Partial<Schema>
): NormalizedSchema {
  const { layoutDirectory, projectDirectory } = extractLayoutDirectory(
    options.directory
  );
  const appDirectory = normalizeDirectory(options.name, projectDirectory);
  const appProjectName = normalizeProjectName(options.name, projectDirectory);
  const e2eProjectName = options.rootProject
    ? 'e2e'
    : `${names(options.name).fileName}-e2e`;

  const { appsDir: defaultAppsDir, standaloneAsDefault } =
    getWorkspaceLayout(host);
  const appsDir = layoutDirectory ?? defaultAppsDir;
  const appProjectRoot = options.rootProject
    ? '.'
    : joinPathFragments(appsDir, appDirectory);
  const e2eProjectRoot = options.rootProject
    ? 'e2e'
    : joinPathFragments(appsDir, `${appDirectory}-e2e`);

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const prefix = normalizeNewProjectPrefix(
    options.prefix,
    getNpmScope(host),
    'app'
  );

  options.standaloneConfig = options.standaloneConfig ?? standaloneAsDefault;

  const ngCliSchematicAppRoot = appProjectName;
  const ngCliSchematicE2ERoot = `${appProjectName}/e2e`;

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
    ngCliSchematicAppRoot,
    ngCliSchematicE2ERoot,
  };
}
