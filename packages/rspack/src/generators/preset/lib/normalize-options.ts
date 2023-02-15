import {
  extractLayoutDirectory,
  getWorkspaceLayout,
  names,
  normalizePath,
  Tree,
} from '@nrwl/devkit';
import { NormalizedSchema, PresetGeneratorSchema } from '../schema';

export function normalizeDirectory(options: PresetGeneratorSchema) {
  const { projectDirectory } = extractLayoutDirectory(options.directory);
  return projectDirectory
    ? `${names(projectDirectory).fileName}/${names(options.name).fileName}`
    : names(options.name).fileName;
}

export function normalizeProjectName(options: PresetGeneratorSchema) {
  return normalizeDirectory(options).replace(new RegExp('/', 'g'), '-');
}

export function normalizeOptions(
  host: Tree,
  options: PresetGeneratorSchema
): NormalizedSchema {
  // --monorepo takes precedence over --rootProject
  // This won't be needed once we add --bundler=rspack to the @nrwl/react:app preset
  const rootProject = !options.monorepo && (options.rootProject ?? true);
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
