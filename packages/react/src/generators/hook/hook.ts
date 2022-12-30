// TODO(jack): Remove inline renderHook function when RTL releases with its own version
import * as ts from 'typescript';
import {
  applyChangesToString,
  convertNxGenerator,
  formatFiles,
  generateFiles,
  getProjects,
  joinPathFragments,
  logger,
  names,
  toJS,
  Tree,
} from '@nrwl/devkit';

import { Schema } from './schema';
import { addImport } from '../../utils/ast-utils';

interface NormalizedSchema extends Schema {
  projectSourceRoot: string;
  hookName: string;
  hookTypeName: string;
  fileName: string;
}

export async function hookGenerator(host: Tree, schema: Schema) {
  const options = await normalizeOptions(host, schema);

  createFiles(host, options);
  addExportsToBarrel(host, options);

  return await formatFiles(host);
}

function createFiles(host: Tree, options: NormalizedSchema) {
  const hookDir = joinPathFragments(
    options.projectSourceRoot,
    options.directory
  );

  generateFiles(host, joinPathFragments(__dirname, './files'), hookDir, {
    ...options,
    tmpl: '',
  });

  for (const c of host.listChanges()) {
    let deleteFile = false;

    if (options.skipTests && /.*spec.ts/.test(c.path)) {
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
  const isApp = workspace.get(options.project).projectType === 'application';

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
}

async function normalizeOptions(
  host: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  assertValidOptions(options);

  let base = options.name;
  if (base.startsWith('use-')) {
    base = base.substring(4);
  } else if (base.startsWith('use')) {
    base = base.substring(3);
  }

  const { className, fileName } = names(base);
  const hookFilename = options.pascalCaseFiles
    ? 'use'.concat(className)
    : 'use-'.concat(fileName);
  const hookName = 'use'.concat(className);
  const hookTypeName = 'Use'.concat(className);
  const project = getProjects(host).get(options.project);

  if (!project) {
    logger.error(
      `Cannot find the ${options.project} project. Please double check the project name.`
    );
    throw new Error();
  }

  const { sourceRoot: projectSourceRoot, projectType } = project;

  const directory = await getDirectory(host, options, base);

  if (options.export && projectType === 'application') {
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
    projectSourceRoot,
  };
}

async function getDirectory(host: Tree, options: Schema, baseHookName) {
  const { className, fileName } = names(baseHookName);
  const hookFileName =
    options.pascalCaseDirectory === true
      ? 'use'.concat(className)
      : 'use-'.concat(fileName);
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
  return options.flat ? baseDir : joinPathFragments(baseDir, hookFileName);
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
        `Found "${s}" in the hook name. Did you mean to use the --directory option (e.g. \`nx g c ${name} --directory ${suggestion}\`)?`
      );
    }
  });
}

export default hookGenerator;

export const hookSchematic = convertNxGenerator(hookGenerator);
