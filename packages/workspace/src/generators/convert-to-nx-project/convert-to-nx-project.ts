import {
  addProjectConfiguration,
  convertNxGenerator,
  formatFiles,
  readJson,
  Tree,
  updateProjectConfiguration,
  writeJson,
} from '@nx/devkit';
import { join } from 'path';
import { Schema } from './schema';
import { toNewFormat, toOldFormat } from 'nx/src/adapter/angular-json';
import { output } from '../../utils/output';

export async function validateSchema(schema: Schema, configName: string) {
  if (schema.project && schema.all) {
    throw new Error('--project and --all are mutually exclusive');
  }

  if (schema.project && schema.reformat) {
    throw new Error('--project and --reformat are mutually exclusive');
  }

  if (schema.all && schema.reformat) {
    throw new Error('--all and --reformat are mutually exclusive');
  }

  if (
    (configName === 'workspace.json' && schema.project) ||
    (configName === 'workspace.json' && schema.reformat)
  ) {
    throw new Error(
      'workspace.json is no longer supported. Please pass --all to convert all projects and remove workspace.json.'
    );
  }

  if (!schema.project && !schema.all && !schema.reformat) {
    schema.all = true;
  }
}

export async function convertToNxProjectGenerator(host: Tree, schema: Schema) {
  const configName = host.exists('angular.json')
    ? 'angular.json'
    : 'workspace.json';

  if (!host.exists(configName)) return;

  await validateSchema(schema, configName);

  const projects = toNewFormat(readJson(host, configName)).projects;
  const leftOverProjects = {};

  for (const projectName of Object.keys(projects)) {
    const config = projects[projectName];
    if (
      (!schema.project || schema.project === projectName) &&
      !schema.reformat
    ) {
      if (typeof config === 'string') {
        // configuration is in project.json
        const projectConfig = readJson(host, join(config, 'project.json'));
        if (projectConfig.name !== projectName) {
          projectConfig.name = projectName;
          projectConfig.root = config;
          updateProjectConfiguration(host, projectName, projectConfig);
        }
      } else {
        // configuration is an object in workspace.json
        const path = join(config.root, 'project.json');
        if (!host.exists(path)) {
          projects[projectName].name = projectName;
          addProjectConfiguration(host, path, projects[projectName]);
        }
      }
    } else {
      leftOverProjects[projectName] = config;
    }
  }

  if (Object.keys(leftOverProjects).length > 0) {
    writeJson(
      host,
      'angular.json',
      toOldFormat({ version: 1, projects: leftOverProjects })
    );
  } else {
    host.delete(configName);
  }

  if (!schema.skipFormat) {
    await formatFiles(host);
  }

  output.note({
    title: 'Use "nx show projects" to read the list of projects.',
    bodyLines: [
      `If you read the list of projects from ${configName}, use "nx show projects" instead.`,
    ],
  });
}

export default convertToNxProjectGenerator;

export const convertToNxProjectSchematic = convertNxGenerator(
  convertToNxProjectGenerator
);
