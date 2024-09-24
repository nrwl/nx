import { Tree } from '@nx/devkit';
import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { CreatePackageSchema } from '../schema';

export interface NormalizedSchema extends CreatePackageSchema {
  bundler: 'swc' | 'tsc';
  projectName: string;
  projectRoot: string;
}

export async function normalizeSchema(
  host: Tree,
  schema: CreatePackageSchema
): Promise<NormalizedSchema> {
  const {
    projectName,
    names: projectNames,
    projectRoot,
  } = await determineProjectNameAndRootOptions(host, {
    name: schema.name,
    projectType: 'library',
    directory: schema.directory,
  });

  return {
    ...schema,
    bundler: schema.compiler ?? 'tsc',
    projectName,
    projectRoot,
    name: projectNames.projectSimpleName,
  };
}
