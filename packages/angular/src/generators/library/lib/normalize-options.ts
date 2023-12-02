import { names, Tree } from '@nx/devkit';
import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { getNpmScope } from '@nx/js/src/utils/package-json/get-npm-scope';
import { Linter } from '@nx/eslint';
import { UnitTestRunner } from '../../../utils/test-runners';
import { normalizeNewProjectPrefix } from '../../utils/project';
import { Schema } from '../schema';
import { NormalizedSchema } from './normalized-schema';

export async function normalizeOptions(
  host: Tree,
  schema: Schema
): Promise<NormalizedSchema> {
  schema.standalone = schema.standalone ?? true;
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

  const {
    projectName,
    names: projectNames,
    projectRoot,
    importPath,
  } = await determineProjectNameAndRootOptions(host, {
    name: options.name,
    projectType: 'library',
    directory: options.directory,
    importPath: options.importPath,
    projectNameAndRootFormat: options.projectNameAndRootFormat,
    callingGenerator: '@nx/angular:library',
  });

  const fileName = options.simpleName
    ? projectNames.projectSimpleName
    : projectNames.projectFileName;

  const moduleName = `${names(fileName).className}Module`;
  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];
  const modulePath = `${projectRoot}/src/lib/${fileName}.module.ts`;

  const npmScope = getNpmScope(host);
  const prefix = normalizeNewProjectPrefix(options.prefix, npmScope, 'lib');

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
    modulePath,
    parsedTags,
    fileName,
    importPath,
    ngCliSchematicLibRoot,
    standaloneComponentName: `${
      names(projectNames.projectSimpleName).className
    }Component`,
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
