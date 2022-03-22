import {
  getWorkspaceLayout,
  getWorkspacePath,
  joinPathFragments,
  readJson,
  Tree,
} from '@nrwl/devkit';
import { Schema } from '../schema';
import { NormalizedSchema } from './normalized-schema';
import { names } from '@nrwl/devkit';
import { Linter } from '@nrwl/linter';
import { UnitTestRunner } from '../../../utils/test-runners';

export function normalizeOptions(
  host: Tree,
  schema: Partial<Schema>
): NormalizedSchema {
  // Create a schema with populated default values
  const options: Schema = {
    buildable: false,
    linter: Linter.EsLint,
    name: '', // JSON validation will ensure this is set
    publishable: false,
    simpleModuleName: false,
    skipFormat: false,
    unitTestRunner: UnitTestRunner.Jest,
    // Publishable libs cannot use `full` yet, so if its false then use the passed value or default to `full`
    compilationMode: schema.publishable
      ? 'partial'
      : schema.compilationMode ?? 'full',
    skipModule: schema.skipModule ?? false,
    ...schema,
  };

  const name = names(options.name).fileName;
  const projectDirectory = options.directory
    ? `${names(options.directory).fileName}/${name}`.replace(/\/+/g, '/')
    : name;

  const { libsDir, npmScope, standaloneAsDefault } = getWorkspaceLayout(host);

  const projectName = projectDirectory
    .replace(new RegExp('/', 'g'), '-')
    .replace(/-\d+/g, '');
  const fileName = options.simpleModuleName ? name : projectName;
  const projectRoot = joinPathFragments(libsDir, projectDirectory);

  const moduleName = `${names(fileName).className}Module`;
  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];
  const modulePath = `${projectRoot}/src/lib/${fileName}.module.ts`;
  const defaultPrefix = npmScope;

  options.standaloneConfig = options.standaloneConfig ?? standaloneAsDefault;

  const importPath =
    options.importPath || `@${defaultPrefix}/${projectDirectory}`;

  // Determine the roots where @schematics/angular will place the projects
  // This might not be where the projects actually end up
  const workspaceJsonPath = getWorkspacePath(host);
  let newProjectRoot = null;
  if (workspaceJsonPath) {
    ({ newProjectRoot } = readJson(host, workspaceJsonPath));
  }
  const ngCliSchematicLibRoot = newProjectRoot
    ? `${newProjectRoot}/${projectName}`
    : projectName;

  return {
    ...options,
    linter: options.linter ?? Linter.EsLint,
    unitTestRunner: options.unitTestRunner ?? UnitTestRunner.Jest,
    prefix: options.prefix ?? defaultPrefix,
    name: projectName,
    projectRoot,
    entryFile: 'index',
    moduleName,
    projectDirectory,
    modulePath,
    parsedTags,
    fileName,
    importPath,
    ngCliSchematicLibRoot,
  };
}
