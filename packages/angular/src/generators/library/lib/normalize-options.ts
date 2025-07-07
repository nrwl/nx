import { names, type Tree } from '@nx/devkit';
import {
  determineProjectNameAndRootOptions,
  ensureRootProjectName,
} from '@nx/devkit/src/generators/project-name-and-root-utils';
import { UnitTestRunner } from '../../../utils/test-runners';
import {
  getComponentType,
  getModuleTypeSeparator,
} from '../../utils/artifact-types';
import type { Schema } from '../schema';
import type { NormalizedSchema } from './normalized-schema';

export async function normalizeOptions(
  host: Tree,
  schema: Schema
): Promise<NormalizedSchema> {
  schema.standalone = schema.standalone ?? true;
  // Create a schema with populated default values
  const options: Schema = {
    buildable: false,
    linter: 'eslint',
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

  await ensureRootProjectName(options, 'library');
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
  });

  const fileName = options.simpleName
    ? projectNames.projectSimpleName
    : projectNames.projectFileName;

  const moduleName = `${names(fileName).className}Module`;
  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];
  const moduleTypeSeparator = getModuleTypeSeparator(host);
  const modulePath = `${projectRoot}/src/lib/${fileName}${moduleTypeSeparator}module.ts`;

  const ngCliSchematicLibRoot = projectName;
  const allNormalizedOptions = {
    ...options,
    linter: options.linter ?? 'eslint',
    unitTestRunner: options.unitTestRunner ?? UnitTestRunner.Jest,
    prefix: options.prefix ?? 'lib',
    name: projectName,
    projectRoot,
    entryFile: 'index',
    moduleName,
    modulePath,
    parsedTags,
    fileName,
    importPath,
    ngCliSchematicLibRoot,
    skipTests: options.unitTestRunner === 'none' ? true : options.skipTests,
    standaloneComponentName: `${
      names(projectNames.projectSimpleName).className
    }Component`,
    moduleTypeSeparator,
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

  const componentType = getComponentType(host);

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
      type: componentType,
    },
  };
}
