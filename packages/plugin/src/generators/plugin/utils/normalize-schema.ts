import {
  extractLayoutDirectory,
  getImportPath,
  getWorkspaceLayout,
  joinPathFragments,
  names,
  Tree,
} from '@nx/devkit';
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
  bundler: 'swc' | 'tsc';
  publishable: boolean;
}
export function normalizeOptions(
  host: Tree,
  options: Schema
): NormalizedSchema {
  const { layoutDirectory, projectDirectory } = extractLayoutDirectory(
    options.directory
  );
  const { npmScope, libsDir: defaultLibsDir } = getWorkspaceLayout(host);
  const libsDir = layoutDirectory ?? defaultLibsDir;
  const name = names(options.name).fileName;
  const fullProjectDirectory = projectDirectory
    ? `${names(projectDirectory).fileName}/${name}`
    : options.rootProject
    ? '.'
    : name;

  const projectName = options.rootProject
    ? name
    : fullProjectDirectory.replace(new RegExp('/', 'g'), '-');
  const fileName = projectName;
  const projectRoot = options.rootProject
    ? fullProjectDirectory
    : joinPathFragments(libsDir, fullProjectDirectory);

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const npmPackageName = options.importPath || getImportPath(npmScope, name);

  return {
    ...options,
    bundler: options.compiler ?? 'tsc',
    fileName,
    npmScope,
    libsDir,
    name: projectName,
    projectRoot,
    projectDirectory: fullProjectDirectory,
    parsedTags,
    npmPackageName,
    publishable: options.publishable ?? false,
  };
}
