import {
  applyChangesToString,
  getProjects,
  joinPathFragments,
  logger,
  names,
  Tree,
} from '@nx/devkit';
import { parse, relative, dirname } from 'path';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { determineArtifactNameAndDirectoryOptions } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';

import { NormalizedSchema, ComponentGeneratorSchema } from '../schema';
import { addImport } from '../../../utils/ast-utils';

let tsModule: typeof import('typescript');

export async function normalizeOptions(
  host: Tree,
  options: ComponentGeneratorSchema
): Promise<NormalizedSchema> {
  const {
    artifactName: name,
    directory,
    fileName,
    filePath,
    project: projectName,
  } = await determineArtifactNameAndDirectoryOptions(host, {
    artifactType: 'component',
    callingGenerator: '@nx/vue:component',
    name: options.name,
    directory: options.directory,
    derivedDirectory: options.directory,
    flat: options.flat,
    nameAndDirectoryFormat: options.nameAndDirectoryFormat,
    project: options.project,
    fileExtension: 'vue',
    pascalCaseFile: options.pascalCaseFiles,
    pascalCaseDirectory: options.pascalCaseDirectory,
  });

  let { className } = names(fileName);
  const componentFileName = fileName;
  const project = getProjects(host).get(projectName);
  const { sourceRoot: projectSourceRoot, projectType } = project;

  if (options.export && projectType === 'application') {
    logger.warn(
      `The "--export" option should not be used with applications and will do nothing.`
    );
  }

  options.routing = options.routing ?? false;
  options.inSourceTests = options.inSourceTests ?? false;

  return {
    ...options,
    filePath,
    directory,
    className,
    fileName: componentFileName,
    projectSourceRoot,
    projectName,
  };
}

export function addExportsToBarrel(host: Tree, options: NormalizedSchema) {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const workspace = getProjects(host);
  const isApp =
    workspace.get(options.projectName).projectType === 'application';

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

      const relativePathFromIndex = getRelativeImportToFile(
        indexFilePath,
        options.filePath
      );
      const changes = applyChangesToString(
        indexSource,
        addImport(
          indexSourceFile,
          `export { default as ${options.className} } from '${relativePathFromIndex}';`
        )
      );
      host.write(indexFilePath, changes);
    }
  }
}

function getRelativeImportToFile(indexPath: string, filePath: string) {
  const { base, dir } = parse(filePath);
  const relativeDirToTarget = relative(dirname(indexPath), dir);
  return `./${joinPathFragments(relativeDirToTarget, base)}`;
}
