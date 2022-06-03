import {
  getWorkspaceLayout,
  joinPathFragments,
  names,
  Tree,
} from '@nrwl/devkit';
import { Schema } from '../schema';

export interface NormalizedSchema extends Schema {
  name: string;
  fileName: string;
  libsDir: string;
  projectRoot: string;
  projectDirectory: string;
  parsedTags: string[];
  npmScope: string;
  npmPackageName: string;
}
export function normalizeOptions(
  host: Tree,
  options: Schema
): NormalizedSchema {
  const { npmScope, libsDir } = getWorkspaceLayout(host);
  const name = names(options.name).fileName;
  const projectDirectory = options.directory
    ? `${names(options.directory).fileName}/${name}`
    : name;

  const projectName = projectDirectory.replace(new RegExp('/', 'g'), '-');
  const fileName = projectName;
  const projectRoot = joinPathFragments(libsDir, projectDirectory);

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const npmPackageName =
    options.importPath || resolvePackageName(npmScope, name);

  return {
    ...options,
    fileName,
    npmScope,
    libsDir,
    name: projectName,
    projectRoot,
    projectDirectory,
    parsedTags,
    npmPackageName,
  };
}

function resolvePackageName(npmScope: string, name: string): string {
  if (npmScope && npmScope !== '') {
    return `@${npmScope}/${name}`;
  } else {
    return name;
  }
}
