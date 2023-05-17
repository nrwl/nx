import {
  extractLayoutDirectory,
  getWorkspaceLayout,
  joinPathFragments,
  names,
  Tree,
} from '@nx/devkit';

import { getImportPath } from '@nx/js/src/utils/get-import-path';
import { getNpmScope } from '@nx/js/src/utils/package-json/get-npm-scope';

import { Linter } from '@nx/linter';

import { Schema } from '../schema';
import { NormalizedSchema } from './normalized-schema';
import { UnitTestRunner } from '../../../utils/test-runners';
import { normalizeNewProjectPrefix } from '../../utils/project';

export function normalizeOptions(host: Tree, schema: Schema): NormalizedSchema {
  // Create a schema with populated default values
  const options: Schema = {
    buildable: false,
    linter: Linter.EsLint,
    publishable: false,
    simpleName: false,
    skipFormat: false,
    unitTestRunner: UnitTestRunner.Jest,
    // Publishable libs cannot use `full` yet, so if its false then use the passed value or default to `full`
    compilationMode: schema.publishable
      ? 'partial'
      : schema.compilationMode ?? 'full',
    skipModule: schema.skipModule || schema.standalone,
    ...schema,
  };

  const name = names(options.name).fileName;
  const { layoutDirectory, projectDirectory } = extractLayoutDirectory(
    options.directory
  );
  const fullProjectDirectory = projectDirectory
    ? `${names(projectDirectory).fileName}/${name}`.replace(/\/+/g, '/')
    : name;

  const { libsDir: defaultLibsDirectory, standaloneAsDefault } =
    getWorkspaceLayout(host);
  const npmScope = getNpmScope(host);
  const libsDir = layoutDirectory ?? defaultLibsDirectory;

  const projectName = fullProjectDirectory
    .replace(new RegExp('/', 'g'), '-')
    .replace(/-\d+/g, '');
  const fileName = options.simpleName ? name : projectName;
  const projectRoot = joinPathFragments(libsDir, fullProjectDirectory);

  const moduleName = `${names(fileName).className}Module`;
  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];
  const modulePath = `${projectRoot}/src/lib/${fileName}.module.ts`;
  const prefix = normalizeNewProjectPrefix(options.prefix, npmScope, 'lib');

  options.standaloneConfig = options.standaloneConfig ?? standaloneAsDefault;

  const importPath =
    options.importPath || getImportPath(host, fullProjectDirectory);

  const ngCliSchematicLibRoot = projectName;
  const allNormalizedOptions = {
    ...options,
    linter: options.linter ?? Linter.EsLint,
    unitTestRunner: options.unitTestRunner ?? UnitTestRunner.Jest,
    prefix,
    name: projectName,
    projectRoot,
    entryFile: 'index',
    moduleName,
    projectDirectory: fullProjectDirectory,
    modulePath,
    parsedTags,
    fileName,
    importPath,
    ngCliSchematicLibRoot,
    standaloneComponentName: `${names(name).className}Component`,
  };

  const {
    displayBlock,
    inlineStyle,
    inlineTemplate,
    viewEncapsulation,
    changeDetection,
    style,
    skipTests,
    selector,
    skipSelector,
    flat,
    ...libraryOptions
  } = allNormalizedOptions;

  return {
    libraryOptions,
    componentOptions: {
      name: fileName,
      standalone: libraryOptions.standalone,
      displayBlock,
      inlineStyle,
      inlineTemplate,
      viewEncapsulation,
      changeDetection,
      style,
      skipTests,
      selector,
      skipSelector,
      flat,
    },
  };
}
