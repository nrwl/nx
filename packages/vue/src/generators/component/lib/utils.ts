import {
  applyChangesToString,
  getProjects,
  joinPathFragments,
  logger,
  names,
  Tree,
} from '@nx/devkit';
import { NormalizedSchema, Schema } from '../schema';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { addImport } from '../../../utils/ast-utils';

let tsModule: typeof import('typescript');

export async function normalizeOptions(
  host: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  assertValidOptions(options);

  const { className, fileName } = names(options.name);
  const componentFileName =
    options.fileName ?? (options.pascalCaseFiles ? className : fileName);
  const project = getProjects(host).get(options.project);

  if (!project) {
    throw new Error(
      `Cannot find the ${options.project} project. Please double check the project name.`
    );
  }

  const { sourceRoot: projectSourceRoot, projectType } = project;

  const directory = await getDirectory(options);

  if (options.export && projectType === 'application') {
    logger.warn(
      `The "--export" option should not be used with applications and will do nothing.`
    );
  }

  options.routing = options.routing ?? false;
  options.inSourceTests = options.inSourceTests ?? false;

  return {
    ...options,
    directory,
    className,
    fileName: componentFileName,
    projectSourceRoot,
  };
}

export function addExportsToBarrel(host: Tree, options: NormalizedSchema) {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const workspace = getProjects(host);
  const isApp = workspace.get(options.project).projectType === 'application';

  if (options.export && !isApp) {
    const indexFilePath = joinPathFragments(
      options.projectSourceRoot,
      options.js ? 'index.js' : 'index.ts'
    );
    const indexSource = host.read(indexFilePath, 'utf-8');
    if (indexSource !== null) {
      const indexSourceFile = tsModule.createSourceFile(
        indexFilePath,
        indexSource,
        tsModule.ScriptTarget.Latest,
        true
      );
      const changes = applyChangesToString(
        indexSource,
        addImport(
          indexSourceFile,
          `export { default as ${options.className} } from './${options.directory}/${options.fileName}.vue';`
        )
      );
      host.write(indexFilePath, changes);
    }
  }
}

export async function getDirectory(options: Schema) {
  if (options.directory) return options.directory;
  if (options.flat) return 'components';
  const { className, fileName } = names(options.name);
  const nestedDir = options.pascalCaseDirectory === true ? className : fileName;
  return joinPathFragments('components', nestedDir);
}

export function assertValidOptions(options: Schema) {
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
