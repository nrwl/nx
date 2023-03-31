import {
  extractLayoutDirectory,
  getWorkspaceLayout,
  joinPathFragments,
  names,
  Tree,
} from '@nrwl/devkit';
import { CreatePackageSchema } from '../schema';

export interface NormalizedSchema extends CreatePackageSchema {
  bundler: 'swc' | 'tsc';
  libsDir: string;
  projectName: string;
  projectRoot: string;
  projectDirectory: string;
}

export function normalizeSchema(
  host: Tree,
  schema: CreatePackageSchema
): NormalizedSchema {
  const { layoutDirectory, projectDirectory } = extractLayoutDirectory(
    schema.directory
  );
  const { libsDir: defaultLibsDir } = getWorkspaceLayout(host);
  const libsDir = layoutDirectory ?? defaultLibsDir;
  const name = names(schema.name).fileName;
  const fullProjectDirectory = projectDirectory
    ? `${names(projectDirectory).fileName}/${name}`
    : name;
  const projectName = fullProjectDirectory.replace(new RegExp('/', 'g'), '-');
  const projectRoot = joinPathFragments(libsDir, fullProjectDirectory);
  const importPath = schema.importPath ?? name;
  return {
    ...schema,
    bundler: schema.compiler ?? 'tsc',
    libsDir,
    projectName,
    projectRoot,
    name,
    projectDirectory: fullProjectDirectory,
    importPath,
  };
}
