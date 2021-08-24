import {
  getProjects,
  joinPathFragments,
  logger,
  names,
  Tree,
} from '@nrwl/devkit';
import { Schema } from '../schema';

export interface NormalizedSchema extends Schema {
  projectSourceRoot: string;
  fileName: string;
  className: string;
}

export async function normalizeOptions(
  host: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  assertValidOptions(options);

  const { className, fileName } = names(options.name);
  const componentFileName = options.pascalCaseFiles ? className : fileName;
  const project = getProjects(host).get(options.project);

  if (!project) {
    logger.error(
      `Cannot find the ${options.project} project. Please double check the project name.`
    );
    throw new Error();
  }

  const { sourceRoot: projectSourceRoot, projectType } = project;

  const directory = await getDirectory(host, options);

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
    fileName: componentFileName,
    projectSourceRoot,
  };
}

async function getDirectory(host: Tree, options: Schema) {
  const fileName = names(options.name).fileName;
  const workspace = getProjects(host);
  let baseDir: string;
  if (options.directory) {
    baseDir = options.directory;
  } else {
    baseDir =
      workspace.get(options.project).projectType === 'application'
        ? 'app'
        : 'lib';
  }
  return options.flat ? baseDir : joinPathFragments(baseDir, fileName);
}

function assertValidOptions(options: Schema) {
  const slashes = ['/', '\\'];
  slashes.forEach((s) => {
    if (options.name.indexOf(s) !== -1) {
      const [name, ...rest] = options.name.split(s).reverse();
      let suggestion = rest.map((x) => x.toLowerCase()).join(s);
      if (options.directory) {
        suggestion = `${options.directory}${s}${suggestion}`;
      }
      throw new Error(
        `Found "${s}" in the component name. Did you mean to use the --directory option (e.g. \`nx g c ${name} --directory ${suggestion}\`)?`
      );
    }
  });
}
