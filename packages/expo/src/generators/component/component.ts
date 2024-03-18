import * as ts from 'typescript';
import { Schema } from './schema';
import {
  applyChangesToString,
  formatFiles,
  generateFiles,
  getProjects,
  joinPathFragments,
  toJS,
  Tree,
} from '@nx/devkit';
import { NormalizedSchema, normalizeOptions } from './lib/normalize-options';
import { addImport } from './lib/add-import';
import { dirname, join, parse, relative } from 'path';

export async function expoComponentGenerator(host: Tree, schema: Schema) {
  return expoComponentGeneratorInternal(host, {
    nameAndDirectoryFormat: 'derived',
    ...schema,
  });
}

export async function expoComponentGeneratorInternal(
  host: Tree,
  schema: Schema
) {
  const options = await normalizeOptions(host, schema);
  createComponentFiles(host, options);

  addExportsToBarrel(host, options);

  if (options.skipFormat) {
    await formatFiles(host);
  }
}

function createComponentFiles(host: Tree, options: NormalizedSchema) {
  generateFiles(host, join(__dirname, './files'), options.directory, {
    ...options,
    tmpl: '',
  });

  for (const c of host.listChanges()) {
    let deleteFile = false;

    if (options.skipTests && /.*spec.tsx/.test(c.path)) {
      deleteFile = true;
    }

    if (deleteFile) {
      host.delete(c.path);
    }
  }

  if (options.js) {
    toJS(host);
  }
}

function addExportsToBarrel(host: Tree, options: NormalizedSchema) {
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
}

function getRelativeImportToFile(indexPath: string, filePath: string) {
  const { name, dir } = parse(filePath);
  const relativeDirToTarget = relative(dirname(indexPath), dir);
  return `./${joinPathFragments(relativeDirToTarget, name)}`;
}

export default expoComponentGenerator;
