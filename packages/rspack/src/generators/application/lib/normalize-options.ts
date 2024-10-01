import {
  extractLayoutDirectory,
  getWorkspaceLayout,
  names,
  normalizePath,
  Tree,
} from '@nx/devkit';
import { ApplicationGeneratorSchema, NormalizedSchema } from '../schema';

export function normalizeDirectory(options: ApplicationGeneratorSchema) {
  const { projectDirectory } = extractLayoutDirectory(options.directory);
  return projectDirectory
    ? `${names(projectDirectory).fileName}/${names(options.name).fileName}`
    : names(options.name).fileName;
}

export function normalizeProjectName(options: ApplicationGeneratorSchema) {
  return normalizeDirectory(options).replace(new RegExp('/', 'g'), '-');
}

export function normalizeOptions(
  host: Tree,
  options: ApplicationGeneratorSchema
): NormalizedSchema {
  // --monorepo takes precedence over --rootProject
  // This won't be needed once we add --bundler=rspack to the @nx/react:app preset
  const rootProject = !options.monorepo && options.rootProject;
  const appDirectory = normalizeDirectory(options);
  const appProjectName = normalizeProjectName(options);
  const e2eProjectName = options.rootProject
    ? 'e2e'
    : `${names(options.name).fileName}-e2e`;

  const { layoutDirectory } = extractLayoutDirectory(options.directory);
  const appsDir = layoutDirectory ?? getWorkspaceLayout(host).appsDir;
  const appProjectRoot = rootProject
    ? '.'
    : normalizePath(`${appsDir}/${appDirectory}`);

  const normalized = {
    ...options,
    rootProject,
    name: names(options.name).fileName,
    projectName: appProjectName,
    appProjectRoot,
    e2eProjectName,
    fileName: 'app',
  } as NormalizedSchema;

  normalized.unitTestRunner ??= 'jest';
  normalized.e2eTestRunner ??= 'cypress';

  return normalized;
}
