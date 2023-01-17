import {
  addProjectConfiguration,
  convertNxGenerator,
  formatFiles,
  readJson,
  Tree,
  writeJson,
} from '@nrwl/devkit';
import { join } from 'path';
import { Schema } from './schema';
import { toNewFormat, toOldFormat } from 'nx/src/adapter/angular-json';

export async function validateSchema(schema: Schema, configName: string) {
  if (schema.project && schema.all) {
    throw new Error('--project and --all are mutually exclusive');
  }

  if (configName === 'workspace.json' && schema.project) {
    throw new Error(
      'workspace.json is no longer supported. Please pass --all to convert all projects and remove workspace.json.'
    );
  }

  if (!schema.project && !schema.all) {
    schema.all = true;
  }
}

export async function convertToNxProjectGenerator(host: Tree, schema: Schema) {
  const configName = host.exists('angular.json')
    ? 'angular.json'
    : 'workspace.json';

  await validateSchema(schema, configName);

  const projects = toNewFormat(readJson(host, configName)).projects;
  const leftOverProjects = {};

  for (const projectName of Object.keys(projects)) {
    const config = projects[projectName];
    if (!schema.project || schema.project === projectName) {
      const path = join(config.root, 'project.json');
      delete config.root;
      if (!host.exists(path)) {
        addProjectConfiguration(host, path, projects[projectName]);
      }
    } else {
      leftOverProjects[projectName] = config;
    }
  }

  writeJson(host, 'angular.json', toOldFormat({ version: 1, projects }));

  if (!schema.skipFormat) {
    await formatFiles(host);
  }
}

export default convertToNxProjectGenerator;

export const convertToNxProjectSchematic = convertNxGenerator(
  convertToNxProjectGenerator
);
