import { Tree } from '@nx/devkit';
import { ApplicationGeneratorSchema, NormalizedSchema } from '../schema';
import {
  determineProjectNameAndRootOptions,
  ensureRootProjectName,
} from '@nx/devkit/src/generators/project-name-and-root-utils';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';

export async function normalizeOptions(
  host: Tree,
  options: ApplicationGeneratorSchema
): Promise<NormalizedSchema> {
  await ensureRootProjectName(options, 'application');
  const {
    projectName,
    projectRoot: appProjectRoot,
    importPath,
  } = await determineProjectNameAndRootOptions(host, {
    ...options,
    projectType: 'application',
  });
  // --monorepo takes precedence over --rootProject
  // This won't be needed once we add --bundler=rspack to the @nx/react:app preset
  const rootProject = !options.monorepo && options.rootProject;

  const isTsSolutionSetup = isUsingTsSolutionSetup(host);
  const appProjectName =
    !isTsSolutionSetup || options.name ? projectName : importPath;

  const e2eProjectName = options.rootProject ? 'e2e' : `${projectName}-e2e`;

  const normalized = {
    ...options,
    rootProject,
    name: appProjectName,
    projectName: appProjectName,
    appProjectRoot,
    e2eProjectName,
    fileName: 'app',
  } as NormalizedSchema;

  normalized.unitTestRunner ??= 'jest';
  normalized.e2eTestRunner ??= 'cypress';

  return normalized;
}
