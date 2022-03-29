import { names } from '@nrwl/devkit';
import { GeneratorOptions } from '../schema';
import { WorkspaceProjects } from './types';

export function normalizeOptions(
  options: GeneratorOptions,
  projects: WorkspaceProjects
): GeneratorOptions {
  // TODO: this restrictions will be removed, it's here temporarily to
  // execute for both a full migration and a minimal one to maintain
  // the current behavior
  const hasLibraries = projects.libs.length > 0;
  if (projects.apps.length > 2 || hasLibraries) {
    throw new Error('Can only convert projects with one app');
  }

  let npmScope = options.npmScope ?? options.name;
  if (npmScope) {
    npmScope = names(npmScope).fileName;
  } else {
    npmScope = projects.apps[0].name;
  }

  return { ...options, npmScope };
}
