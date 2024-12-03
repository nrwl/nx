import {
  addDependenciesToPackageJson,
  applyChangesToString,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  getProjects,
  joinPathFragments,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { dirname, join, parse, relative } from 'path';

import { addStyledModuleDependencies } from '../../rules/add-styled-dependencies';
import { addImport } from '../../utils/ast-utils';
import { getInSourceVitestTestsTemplate } from '../../utils/get-in-source-vitest-tests-template';
import { reactRouterDomVersion } from '../../utils/versions';
import { getComponentTests } from './lib/get-component-tests';
import { NormalizedSchema, Schema } from './schema';
import { normalizeOptions } from './lib/normalize-options';

export async function componentGenerator(host: Tree, schema: Schema) {
  const options = await normalizeOptions(host, schema);
  createComponentFiles(host, options);

  const tasks: GeneratorCallback[] = [];

  const styledTask = addStyledModuleDependencies(host, options);
  tasks.push(styledTask);

  addExportsToBarrel(host, options);

  if (options.routing) {
    const routingTask = addDependenciesToPackageJson(
      host,
      { 'react-router-dom': reactRouterDomVersion },
      {}
    );
    tasks.push(routingTask);
  }

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(...tasks);
}

function createComponentFiles(host: Tree, options: NormalizedSchema) {
  const componentTests = getComponentTests(options);
  generateFiles(host, join(__dirname, './files'), options.directory, {
    ...options,
    componentTests,
    inSourceVitestTests: getInSourceVitestTestsTemplate(componentTests),
    isTs: options.fileExtensionType === 'ts',
    ext: options.fileExtension,
  });

  if (options.skipTests || options.inSourceTests) {
    host.delete(
      joinPathFragments(
        options.directory,
        `${options.fileName}.spec.${options.fileExtension}`
      )
    );
  }

  if (options.styledModule || !options.hasStyles || !options.globalCss) {
    host.delete(
      join(options.directory, `${options.fileName}.${options.style}`)
    );
  }

  if (options.styledModule || !options.hasStyles || options.globalCss) {
    host.delete(
      join(options.directory, `${options.fileName}.module.${options.style}`)
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
      ...(options.projectSourceRoot
        ? [options.projectSourceRoot]
        : [options.projectRoot, 'src']),
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

export default componentGenerator;
