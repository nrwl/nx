import {
  getWorkspaceLayout,
  joinPathFragments,
  names,
  Tree,
} from '@nrwl/devkit';
import { getImportPath } from 'nx/src/utils/path';
import { Schema } from '../schema';

export interface NormalizedSchema extends Schema {
  name: string;
  fileName: string;
  projectRoot: string;
  routePath: string;
  projectDirectory: string;
  parsedTags: string[];
  appMain?: string;
  appSourceRoot?: string;
}

export function normalizeOptions(
  host: Tree,
  options: Schema
): NormalizedSchema {
  const name = names(options.name).fileName;
  const projectDirectory = options.directory
    ? `${names(options.directory).fileName}/${name}`
    : name;

  const projectName = projectDirectory.replace(new RegExp('/', 'g'), '-');
  const fileName = projectName;
  const { libsDir, npmScope } = getWorkspaceLayout(host);
  const projectRoot = joinPathFragments(libsDir, projectDirectory);

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const importPath =
    options.importPath || getImportPath(npmScope, projectDirectory);

  const normalized: NormalizedSchema = {
    ...options,
    fileName,
    routePath: `/${name}`,
    name: projectName,
    projectRoot,
    projectDirectory,
    parsedTags,
    importPath,
  };

  return normalized;
}
