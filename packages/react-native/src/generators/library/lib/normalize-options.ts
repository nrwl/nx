import { getWorkspaceLayout, joinPathFragments, names, Tree } from '@nx/devkit';
import { getImportPath } from '@nx/js/src/utils/get-import-path';
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
  const { libsDir } = getWorkspaceLayout(host);
  const projectRoot = joinPathFragments(libsDir, projectDirectory);

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const importPath =
    options.importPath || getImportPath(host, projectDirectory);

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
