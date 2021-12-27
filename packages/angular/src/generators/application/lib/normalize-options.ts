import { joinPathFragments, Tree } from '@nrwl/devkit';
import type { Schema } from '../schema';
import type { NormalizedSchema } from './normalized-schema';

import { names, getWorkspaceLayout } from '@nrwl/devkit';
import { E2eTestRunner, UnitTestRunner } from '../../../utils/test-runners';
import { Linter } from '@nrwl/linter';

export function normalizeOptions(
  host: Tree,
  options: Partial<Schema>
): NormalizedSchema {
  const { appsDir, npmScope, standaloneAsDefault } = getWorkspaceLayout(host);

  const appDirectory = options.directory
    ? `${names(options.directory).fileName}/${names(options.name).fileName}`
    : names(options.name).fileName;

  let e2eProjectName = `${names(options.name).fileName}-e2e`;
  const appProjectName = appDirectory
    .replace(new RegExp('/', 'g'), '-')
    .replace(/-\d+/g, '');
  if (options.e2eTestRunner !== 'cypress') {
    e2eProjectName = `${appProjectName}-e2e`;
  }

  const appProjectRoot = joinPathFragments(appsDir, appDirectory);
  const e2eProjectRoot = joinPathFragments(appsDir, `${appDirectory}-e2e`);

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const defaultPrefix = npmScope;

  options.standaloneConfig = options.standaloneConfig ?? standaloneAsDefault;

  // Set defaults and then overwrite with user options
  return {
    style: 'css',
    routing: false,
    inlineStyle: false,
    inlineTemplate: false,
    skipTests: false,
    skipFormat: false,
    unitTestRunner: UnitTestRunner.Jest,
    e2eTestRunner: E2eTestRunner.Cypress,
    linter: Linter.EsLint,
    strict: true,
    ...options,
    port: options.port ?? 4200,
    prefix: options.prefix ?? defaultPrefix,
    name: appProjectName,
    appProjectRoot,
    e2eProjectRoot,
    e2eProjectName,
    parsedTags,
  };
}
