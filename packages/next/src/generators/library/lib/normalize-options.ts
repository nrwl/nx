import {
  getImportPath,
  getWorkspaceLayout,
  joinPathFragments,
  names,
  Tree,
} from '@nrwl/devkit';
import { Schema } from '../schema';

export interface NormalizedSchema extends Schema {
  importPath: string;
  projectRoot: string;
}

export function normalizeOptions(
  host: Tree,
  options: Schema
): NormalizedSchema {
  const name = names(options.name).fileName;
  const projectDirectory = options.directory
    ? `${names(options.directory).fileName}/${name}`
    : name;

  const { libsDir } = getWorkspaceLayout(host);
  const projectRoot = joinPathFragments(libsDir, projectDirectory);
  const { npmScope } = getWorkspaceLayout(host);
  return {
    ...options,
    importPath: options.importPath ?? getImportPath(npmScope, projectDirectory),
    projectRoot,
  };
}
