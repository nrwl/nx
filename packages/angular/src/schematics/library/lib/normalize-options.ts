import { Tree } from '@angular-devkit/schematics';
import { getNpmScope } from '@nrwl/workspace';
import { libsDir } from '@nrwl/workspace/src/utils/ast-utils';
import { Schema } from '../schema';
import { NormalizedSchema } from './normalized-schema';
import { names } from '@nrwl/devkit';

export function normalizeOptions(
  host: Tree,
  options: Schema
): NormalizedSchema {
  const name = names(options.name).fileName;
  const projectDirectory = options.directory
    ? `${names(options.directory).fileName}/${name}`
    : name;

  const projectName = projectDirectory.replace(new RegExp('/', 'g'), '-');
  const fileName = options.simpleModuleName ? name : projectName;
  const projectRoot = `${libsDir(host)}/${projectDirectory}`;

  const moduleName = `${names(fileName).className}Module`;
  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];
  const modulePath = `${projectRoot}/src/lib/${fileName}.module.ts`;
  const defaultPrefix = getNpmScope(host);

  const importPath =
    options.importPath || `@${defaultPrefix}/${projectDirectory}`;

  return {
    ...options,
    prefix: options.prefix ? options.prefix : defaultPrefix,
    name: projectName,
    projectRoot,
    entryFile: 'index',
    moduleName,
    projectDirectory,
    modulePath,
    parsedTags,
    fileName,
    importPath,
  };
}
