import * as ts from 'typescript';
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
import { dirname, join, parse, relative } from 'path';

export async function expoComponentGenerator(host: Tree, schema: Schema) {
  const options = await normalizeOptions(host, schema);
  createComponentFiles(host, options);

  addExportsToBarrel(host, options);

  if (options.skipFormat) {
    await formatFiles(host);
  }
}

function createComponentFiles(host: Tree, options: NormalizedSchema) {
  generateFiles(
    host,
    join(__dirname, './files', options.fileExtensionType),
    options.directory,
    {
      ...options,
      ext: options.fileExtension,
    }
  );

  if (options.skipTests) {
    host.delete(
      join(
        options.directory,
        `${options.fileName}.spec.${options.fileExtension}`
      )
    );
  }
}

function addExportsToBarrel(host: Tree, options: NormalizedSchema) {
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
    const indexSourceFile = ts.createSourceFile(
      indexFilePath,
      indexSource,
      ts.ScriptTarget.Latest,
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

export default expoComponentGenerator;
