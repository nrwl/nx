import { Schema } from './schema';
import {
  applyChangesToString,
  formatFiles,
  generateFiles,
  getProjects,
  joinPathFragments,
  Tree,
} from '@nx/devkit';
import { NormalizedSchema, normalizeOptions } from './lib/normalize-options';
import { addImport } from './lib/add-import';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { dirname, join, parse, relative } from 'path';

export async function reactNativeComponentGenerator(
  host: Tree,
  schema: Schema
) {
  const options = await normalizeOptions(host, schema);
  createComponentFiles(host, options);

  addExportsToBarrel(host, options);

  await formatFiles(host);
}

function createComponentFiles(host: Tree, options: NormalizedSchema) {
  generateFiles(
    host,
    join(__dirname, 'files', options.fileExtensionType),
    options.directory,
    {
      ...options,
      ext: options.fileExtension,
    }
  );

  if (options.skipTests) {
    host.delete(
      joinPathFragments(
        options.directory,
        `${options.fileName}.spec.${options.fileExtension}`
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

    const relativePathFromIndex = getRelativeImportToFile(
      indexFilePath,
      options.filePath
    );
    const changes = applyChangesToString(
      indexSource,
      addImport(indexSourceFile, `export * from '${relativePathFromIndex}';`)
    );
    host.write(indexFilePath, changes);
  }
}

function getRelativeImportToFile(indexPath: string, filePath: string) {
  const { name, dir } = parse(filePath);
  const relativeDirToTarget = relative(dirname(indexPath), dir);
  return `./${joinPathFragments(relativeDirToTarget, name)}`;
}

export default reactNativeComponentGenerator;
