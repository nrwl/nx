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
  const {
    artifactName: name,
    directory,
    fileName,
    filePath,
    project: projectName,
  } = await determineArtifactNameAndDirectoryOptions(host, {
    path: options.path,
    name: options.name,
    fileExtension: 'tsx',
  });

  assertValidOptions({ name, directory });

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
    name,
    directory,
    className,
    fileName,
    filePath,
    projectSourceRoot,
    projectName,
  };
}

function assertValidOptions(options: { name: string; directory: string }) {
  const slashes = ['/', '\\'];
  slashes.forEach((s) => {
    if (options.name.indexOf(s) !== -1) {
      const [name, ...rest] = options.name.split(s).reverse();
      let suggestion = rest.map((x) => x.toLowerCase()).join(s);
      if (options.directory) {
        suggestion = `${options.directory}${s}${suggestion}`;
      }
      throw new Error(
        `Found "${s}" in the component name. Did you mean to use the --path option (e.g. \`nx g c ${suggestion}/${name} \`)?`
      );
    }
  });
}
