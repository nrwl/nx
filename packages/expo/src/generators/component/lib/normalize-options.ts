import { getProjects, logger, names, Tree } from '@nx/devkit';
import { Schema } from '../schema';
import { determineArtifactNameAndDirectoryOptions } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';

export interface NormalizedSchema extends Schema {
  directory: string;
  projectSourceRoot: string;
  fileName: string;
  className: string;
  filePath: string;
  projectName: string;
}

export async function normalizeOptions(
  host: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  assertValidOptions(options);

  const {
    artifactName: name,
    fileName,
    filePath,
    directory,
    project: projectName,
  } = await determineArtifactNameAndDirectoryOptions(host, {
    name: options.name,
    path: options.path,
    fileExtension: 'tsx',
  });

  const project = getProjects(host).get(projectName);

  const { className } = names(name);

  const { sourceRoot: projectSourceRoot, projectType } = project;

  if (options.export && projectType === 'application') {
    logger.warn(
      `The "--export" option should not be used with applications and will do nothing.`
    );
  }

  options.classComponent = options.classComponent ?? false;

  return {
    ...options,
    directory,
    className,
    fileName,
    filePath,
    projectSourceRoot,
    projectName,
  };
}

function assertValidOptions(options: Schema) {
  const slashes = ['/', '\\'];
  slashes.forEach((s) => {
    if (options.name.indexOf(s) !== -1) {
      const [name, ...rest] = options.name.split(s).reverse();
      let suggestion = rest.map((x) => x.toLowerCase()).join(s);
      if (options.path) {
        suggestion = `${options.path}${s}${suggestion}`;
      }
      throw new Error(
        `Found "${s}" in the component name. Did you mean to use the --directory option (e.g. \`nx g c ${name} --directory ${suggestion}\`)?`
      );
    }
  });
}
