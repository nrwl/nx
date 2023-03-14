import type { ProjectConfiguration, Tree } from '@nrwl/devkit';
import {
  formatFiles,
  generateFiles,
  getProjects,
  joinPathFragments,
  names,
  readNxJson,
  readProjectConfiguration,
} from '@nrwl/devkit';
import type { Schema } from './schema';
import { checkPathUnderProjectRoot } from '../utils/path';
import { dirname } from 'path';
import { insertNgModuleProperty } from '../utils';
import { insertImport } from '@nrwl/js';
import { ensureTypescript } from '@nrwl/js/src/utils/typescript/ensure-typescript';

let tsModule: typeof import('typescript');

export async function directiveGenerator(tree: Tree, schema: Schema) {
  const projects = getProjects(tree);
  if (!projects.has(schema.project)) {
    throw new Error(`Project "${schema.project}" does not exist!`);
  }

  checkPathUnderProjectRoot(tree, schema.project, schema.path);

  const project = readProjectConfiguration(
    tree,
    schema.project
  ) as ProjectConfiguration & { prefix?: string };

  const path = schema.path ?? `${project.sourceRoot}`;
  const directiveNames = names(schema.name);
  const selector =
    schema.selector ??
    buildSelector(tree, schema.name, schema.prefix ?? project.prefix);

  const pathToGenerateFiles = schema.flat
    ? './files/__directiveFileName__'
    : './files';
  await generateFiles(
    tree,
    joinPathFragments(__dirname, pathToGenerateFiles),
    path,
    {
      selector,
      directiveClassName: directiveNames.className,
      directiveFileName: directiveNames.fileName,
      standalone: schema.standalone,
      tpl: '',
    }
  );

  if (schema.skipTests) {
    const pathToSpecFile = joinPathFragments(
      path,
      `${!schema.flat ? `${directiveNames.fileName}/` : ``}${
        directiveNames.fileName
      }.directive.spec.ts`
    );

    tree.delete(pathToSpecFile);
  }

  if (!schema.skipImport && !schema.standalone) {
    const modulePath = findModule(tree, path, schema.module);
    addImportToNgModule(path, modulePath, schema, directiveNames, tree);
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }
}

function buildSelector(tree: Tree, name: string, prefix: string) {
  let selector = names(name).fileName;
  const selectorPrefix = names(prefix ?? readNxJson(tree).npmScope).fileName;

  return names(`${selectorPrefix}-${selector}`).propertyName;
}

function findModule(tree: Tree, path: string, module?: string) {
  let modulePath = '';
  let pathToSearch = path;
  while (pathToSearch !== '/') {
    if (module) {
      const pathToModule = joinPathFragments(pathToSearch, module);
      if (tree.exists(pathToModule)) {
        modulePath = pathToModule;
        break;
      }
    } else {
      const potentialOptions = tree
        .children(pathToSearch)
        .filter((f) => f.endsWith('.module.ts'));
      if (potentialOptions.length > 1) {
        throw new Error(
          `More than one NgModule was found. Please provide the NgModule you wish to use.`
        );
      } else if (potentialOptions.length === 1) {
        modulePath = joinPathFragments(pathToSearch, potentialOptions[0]);
        break;
      }
    }
    pathToSearch = dirname(pathToSearch);
  }

  const moduleContents = tree.read(modulePath, 'utf-8');
  if (!moduleContents.includes('@NgModule')) {
    throw new Error(
      `Declaring module file (${modulePath}) does not contain an @NgModule Declaration.`
    );
  }

  return modulePath;
}

function addImportToNgModule(
  path: string,
  modulePath: string,
  schema: Schema,
  directiveNames: {
    name: string;
    className: string;
    propertyName: string;
    constantName: string;
    fileName: string;
  },
  tree: Tree
) {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  let relativePath = `${joinPathFragments(
    path.replace(dirname(modulePath), ''),
    !schema.flat ? directiveNames.fileName : '',
    `${directiveNames.fileName}.directive`
  )}`;
  relativePath = relativePath.startsWith('/')
    ? `.${relativePath}`
    : `./${relativePath}`;
  const directiveClassName = `${directiveNames.className}Directive`;

  const moduleContents = tree.read(modulePath, 'utf-8');
  const source = tsModule.createSourceFile(
    modulePath,
    moduleContents,
    tsModule.ScriptTarget.Latest,
    true
  );

  insertImport(tree, source, modulePath, directiveClassName, relativePath);
  insertNgModuleProperty(tree, modulePath, directiveClassName, 'declarations');
  if (schema.export) {
    insertNgModuleProperty(tree, modulePath, directiveClassName, 'exports');
  }
}

export default directiveGenerator;
