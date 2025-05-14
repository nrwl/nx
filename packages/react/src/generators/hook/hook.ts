// TODO(jack): Remove inline renderHook function when RTL releases with its own version
import {
  applyChangesToString,
  formatFiles,
  generateFiles,
  getProjects,
  joinPathFragments,
  logger,
  names,
  Tree,
} from '@nx/devkit';
import {
  determineArtifactNameAndDirectoryOptions,
  type FileExtensionType,
} from '@nx/devkit/src/generators/artifact-name-and-directory-utils';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { join } from 'path';
import { addImport } from '../../utils/ast-utils';
import { Schema } from './schema';
import { getProjectType } from '@nx/js/src/utils/typescript/ts-solution-setup';

interface NormalizedSchema extends Omit<Schema, 'js'> {
  projectSourceRoot: string;
  hookName: string;
  hookTypeName: string;
  fileName: string;
  fileExtension: string;
  fileExtensionType: FileExtensionType;
  projectName: string;
  directory: string;
}

export async function hookGenerator(host: Tree, schema: Schema) {
  const options = await normalizeOptions(host, schema);

  createFiles(host, options);
  addExportsToBarrel(host, options);

  return await formatFiles(host);
}

function createFiles(host: Tree, options: NormalizedSchema) {
  const specExt = options.fileExtensionType === 'ts' ? 'tsx' : 'js';

  generateFiles(host, join(__dirname, './files'), options.directory, {
    ...options,
    ext: options.fileExtension,
    specExt,
    isTs: options.fileExtensionType === 'ts',
  });

  if (options.skipTests) {
    host.delete(
      joinPathFragments(
        options.directory,
        `${options.fileName}.spec.${specExt}`
      )
    );
  }
}

let tsModule: typeof import('typescript');

function addExportsToBarrel(host: Tree, options: NormalizedSchema) {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const workspace = getProjects(host);
  const isApp =
    workspace.get(options.projectName).projectType === 'application';

  if (options.export && !isApp) {
    const indexFilePath = joinPathFragments(
      options.projectSourceRoot,
      options.fileExtensionType === 'js' ? 'index.js' : 'index.ts'
    );

    if (!host.exists(indexFilePath)) {
      return;
    }

    const indexSource = host.read(indexFilePath, 'utf-8');
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
        `export * from './${options.directory}/${options.fileName}';`
      )
    );
    host.write(indexFilePath, changes);
  }
}

async function normalizeOptions(
  host: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  const {
    artifactName,
    directory,
    fileName: hookFilename,
    fileExtension,
    fileExtensionType,
    project: projectName,
  } = await determineArtifactNameAndDirectoryOptions(host, {
    path: options.path,
    name: options.name,
    allowedFileExtensions: ['js', 'ts'],
    fileExtension: options.js ? 'js' : 'ts',
    js: options.js,
  });

  const { className } = names(hookFilename);

  // if name is provided, use it as is for the hook name, otherwise prepend
  // `use` to the pascal-cased file name if it doesn't already start with `use`
  const hookName = options.name
    ? artifactName
    : className.toLocaleLowerCase().startsWith('use')
    ? className
    : `use${className}`;
  const hookTypeName = names(hookName).className;
  const project = getProjects(host).get(projectName);

  const { root, sourceRoot: projectSourceRoot, projectType } = project;

  if (
    options.export &&
    getProjectType(host, root, projectType) === 'application'
  ) {
    logger.warn(
      `The "--export" option should not be used with applications and will do nothing.`
    );
  }

  return {
    ...options,
    directory,
    hookName,
    hookTypeName,
    fileName: hookFilename,
    fileExtension,
    fileExtensionType,
    projectSourceRoot,
    projectName,
  };
}

export default hookGenerator;
